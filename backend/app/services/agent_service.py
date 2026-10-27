"""Run the Codex or Gemini CLI for the browser build.

The desktop app runs these through Tauri commands; this service gives the web
build the same behaviour through the backend. Flags match the desktop build:
Codex runs in its read-only sandbox, Gemini in non-interactive prompt mode.
"""
from __future__ import annotations

import codecs
import json
import os
import shutil
import signal
import subprocess
import tempfile
import threading
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

MAX_PROMPT_CHARS = 64_000
RUN_TIMEOUT_SECONDS = 600
STATUS_TIMEOUT_SECONDS = 15
PROVIDER_NAMES = {"codex": "Codex", "gemini": "Gemini"}


@dataclass(frozen=True, slots=True)
class ProviderStatus:
    installed: bool
    authenticated: bool


def find_binary(name: str) -> str | None:
    """PATH first, then the user-level install folders a GUI launch often leaves off PATH."""
    found = shutil.which(name)
    if found:
        return found
    home = Path.home()
    for folder in (home / ".local/bin", home / ".npm-global/bin", home / ".cargo/bin", home / ".bun/bin"):
        candidate = folder / name
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def provider_status(provider: str) -> ProviderStatus:
    binary = find_binary(provider)
    if binary is None:
        return ProviderStatus(installed=False, authenticated=False)
    if provider == "codex":
        try:
            result = subprocess.run([binary, "login", "status"], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL, timeout=STATUS_TIMEOUT_SECONDS, check=False)
            return ProviderStatus(installed=True, authenticated=result.returncode == 0)
        except (OSError, subprocess.TimeoutExpired):
            return ProviderStatus(installed=True, authenticated=False)
    has_key = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    return ProviderStatus(installed=True, authenticated=has_key or (Path.home() / ".gemini/google_accounts.json").is_file())


def _command(provider: str, binary: str, prompt: str) -> list[str]:
    if provider == "codex":
        return [binary, "exec", "--ephemeral", "--sandbox", "read-only", "--color", "never", "--skip-git-repo-check", "--", prompt]
    return [binary, "--prompt", prompt, "--output-format", "text"]


def _kill(process: subprocess.Popen[bytes]) -> None:
    """Kill the CLI and anything it started; a child left holding stdout would keep the read blocked."""
    try:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGKILL)  # the run has its own session, so its group id is its pid
        else:
            process.kill()
    except (ProcessLookupError, PermissionError):
        pass


def _event(kind: str, **fields: object) -> str:
    return json.dumps({"type": kind, **fields}) + "\n"


def stream_agent(provider: str, prompt: str, working_directory: Path) -> Iterator[str]:
    """Yield NDJSON events: {"type":"chunk","text"} while running, then "done" or "error"."""
    name = PROVIDER_NAMES[provider]
    binary = find_binary(provider)
    if binary is None:
        yield _event("error", message=f"{name} CLI was not found. Install it, sign in with `{provider} login` in the Terminal page, then try again.")
        return
    errors = tempfile.TemporaryFile()  # a file, so a chatty stderr can never block stdout
    try:
        process = subprocess.Popen(_command(provider, binary, prompt), cwd=working_directory, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=errors, start_new_session=os.name == "posix")
    except OSError as exc:
        errors.close()
        yield _event("error", message=f"Could not run {name}: {exc.strerror or exc}")
        return
    content: list[str] = []
    # A read can end inside a multi-byte character; the incremental decoder
    # holds the partial bytes until the rest arrives instead of emitting U+FFFD.
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    # A watchdog rather than a check between reads: a CLI that hangs without printing never returns from read.
    timed_out = threading.Event()

    def stop_at_deadline() -> None:
        timed_out.set()
        _kill(process)

    watchdog = threading.Timer(RUN_TIMEOUT_SECONDS, stop_at_deadline)
    watchdog.daemon = True
    watchdog.start()
    try:
        assert process.stdout is not None
        while True:
            chunk = os.read(process.stdout.fileno(), 4096)
            text = decoder.decode(chunk, final=not chunk)
            if text:
                content.append(text)
                yield _event("chunk", text=text)
            if not chunk:
                break
        if timed_out.is_set():
            yield _event("error", message=f"{name} did not finish within {RUN_TIMEOUT_SECONDS // 60} minutes.")
            return
        code = process.wait(timeout=30)
        reply = "".join(content).strip()
        if code != 0:
            errors.seek(0)
            details = errors.read(8_000).decode("utf-8", errors="replace").strip()
            yield _event("error", message=f"{name} failed: {details[:2000]}" if details else f"{name} did not return a response.")
        elif not reply:
            yield _event("error", message=f"{name} returned an empty response.")
        else:
            yield _event("done", content=reply)
    finally:
        watchdog.cancel()
        if process.poll() is None:  # the client went away
            _kill(process)
            process.wait()
        errors.close()
