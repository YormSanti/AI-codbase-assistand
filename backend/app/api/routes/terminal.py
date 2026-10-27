import os
import sys
import pty
import asyncio
import codecs
import fcntl
import signal
import struct
import termios
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings

router = APIRouter(prefix="/ws", tags=["terminal"])

RESIZE_PREFIX = "\0DEVPILOT_RESIZE:"


def resize_pty(fd: int, cols: int, rows: int) -> None:
    if cols < 1 or rows < 1:
        return
    window_size = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, window_size)


def origin_allowed(origin: str | None) -> bool:
    """Browsers do not apply CORS to WebSockets, so check the page's origin here.

    Without this, any website open in the user's browser could connect to the
    local backend and drive a shell. Clients that send no Origin header (the
    CLI, tests) are not browsers and are allowed.
    """
    return origin is None or origin in settings.cors_origins


@router.websocket("/terminal")
async def terminal_websocket(websocket: WebSocket):
    if not origin_allowed(websocket.headers.get("origin")):
        # Closing before accept() rejects the handshake with HTTP 403.
        await websocket.close(code=1008)
        return
    await websocket.accept()

    requested_cwd = websocket.query_params.get("cwd")
    cwd = Path(requested_cwd).expanduser().resolve() if requested_cwd else Path.home()
    if not cwd.is_dir():
        await websocket.send_text(f"\r\nTerminal directory does not exist: {cwd}\r\n")
        await websocket.close(code=1008)
        return

    try:
        cols = int(websocket.query_params.get("cols", 80))
        rows = int(websocket.query_params.get("rows", 24))
    except (ValueError, TypeError):
        cols, rows = 80, 24

    # Fork a new pty for shell
    pid, fd = pty.fork()
    if pid == 0:
        # Child process
        os.environ["TERM"] = "xterm-256color"
        os.environ["COLORTERM"] = "truecolor"
        os.environ["TERM_PROGRAM"] = "DevPilot"
        os.environ["TERM_PROGRAM_VERSION"] = "1.0"

        # Prevent system shell-integration scripts (/etc/profile.d/vte-2.91.sh,
        # 80-systemd-osc-context.sh) from injecting OSC 7 / OSC 666 / OSC 3008
        # escape sequences into the terminal stream. These are designed for VTE
        # (GNOME Terminal) and confuse xterm.js, appearing as garbled characters.
        os.environ.pop("VTE_VERSION", None)
        os.environ.pop("GNOME_TERMINAL_SCREEN", None)
        os.environ.pop("GNOME_TERMINAL_SERVICE", None)
        # Disable systemd OSC 3008 context signaling
        os.environ["SYSTEMD_OSC_CONTEXT"] = "0"

        # Ensure UTF-8 locale for CLI scripts and modern prompts
        if not os.environ.get("LANG") or os.environ.get("LANG") in ("C", "POSIX"):
            os.environ["LANG"] = "en_US.UTF-8"
        if not os.environ.get("LC_ALL") or os.environ.get("LC_ALL") in ("C", "POSIX"):
            os.environ["LC_ALL"] = "en_US.UTF-8"

        # PyInstaller overrides LD_LIBRARY_PATH, which breaks external
        # commands (like node). Restore the original library path.
        if "LD_LIBRARY_PATH_ORIG" in os.environ:
            os.environ["LD_LIBRARY_PATH"] = os.environ["LD_LIBRARY_PATH_ORIG"]
        else:
            os.environ.pop("LD_LIBRARY_PATH", None)

        # Prepend project venv and standard user bin directories to PATH if missing
        home = Path.home()
        extra_bins = [
            str(cwd / ".venv" / "bin"),
            str(cwd / "venv" / "bin"),
            str(cwd / "node_modules" / ".bin"),
            str(home / ".local" / "bin"),
            str(home / ".cargo" / "bin"),
            str(home / ".bun" / "bin"),
            str(home / ".deno" / "bin"),
            str(home / ".local" / "share" / "pnpm"),
            str(home / ".yarn" / "bin"),
            str(home / ".pyenv" / "shims"),
            str(home / ".pyenv" / "bin"),
            str(home / ".rbenv" / "shims"),
            str(home / "go" / "bin"),
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/snap/bin",
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
        ]
        current_path_list = [p for p in os.environ.get("PATH", "").split(os.pathsep) if p]
        for extra_bin in reversed(extra_bins):
            if os.path.isdir(extra_bin) and extra_bin not in current_path_list:
                current_path_list.insert(0, extra_bin)
        os.environ["PATH"] = os.pathsep.join(current_path_list)

        # Automatically export VIRTUAL_ENV if virtual environment exists in cwd
        if (cwd / ".venv" / "bin" / "python").exists():
            os.environ["VIRTUAL_ENV"] = str(cwd / ".venv")
        elif (cwd / "venv" / "bin" / "python").exists():
            os.environ["VIRTUAL_ENV"] = str(cwd / "venv")

        # Detect user's preferred shell
        user_shell = os.environ.get("SHELL")
        if not user_shell or not os.path.exists(user_shell):
            for candidate in ["/bin/bash", "/usr/bin/bash", "/bin/zsh", "/usr/bin/zsh", "/bin/sh"]:
                if os.path.exists(candidate):
                    user_shell = candidate
                    break
        if not user_shell or not os.path.exists(user_shell):
            user_shell = "/bin/sh"

        shell_name = os.path.basename(user_shell)
        os.chdir(cwd)

        # Set initial dimensions on slave pty before launching shell
        try:
            resize_pty(0, cols, rows)
        except Exception:
            pass

        # Launch interactive shell matching standard OS terminal behavior (-l on macOS, -i on Linux)
        shell_args = [shell_name, "-l"] if sys.platform == "darwin" else [shell_name, "-i"]
        try:
            os.execv(user_shell, shell_args)
        except Exception:
            os.execv("/bin/sh", ["sh", "-i"])
    else:
        # Parent process: set initial dimensions immediately
        try:
            resize_pty(fd, cols, rows)
        except Exception:
            pass

        loop = asyncio.get_running_loop()
        output_queue: asyncio.Queue[str | None] = asyncio.Queue()
        decoder = codecs.getincrementaldecoder("utf-8")("replace")

        def on_pty_readable():
            try:
                chunk = os.read(fd, 65536)
                if not chunk:
                    try:
                        loop.remove_reader(fd)
                    except Exception:
                        pass
                    output_queue.put_nowait(None)
                    return
                text = decoder.decode(chunk)
                if text:
                    output_queue.put_nowait(text)
            except Exception:
                try:
                    loop.remove_reader(fd)
                except Exception:
                    pass
                output_queue.put_nowait(None)

        loop.add_reader(fd, on_pty_readable)

        async def read_from_pty_loop():
            try:
                while True:
                    text = await output_queue.get()
                    if text is None:
                        break
                    chunks = [text]
                    while not output_queue.empty():
                        nxt = output_queue.get_nowait()
                        if nxt is None:
                            await websocket.send_text("".join(chunks))
                            return
                        chunks.append(nxt)
                    await websocket.send_text("".join(chunks))
            except Exception:
                pass

        async def receive_from_ws_loop():
            try:
                while True:
                    data = await websocket.receive_text()
                    if data.startswith(RESIZE_PREFIX):
                        try:
                            c, r = map(int, data[len(RESIZE_PREFIX):].split(":", 1))
                            resize_pty(fd, c, r)
                            os.kill(pid, signal.SIGWINCH)
                        except (ValueError, ProcessLookupError, OSError):
                            pass
                        continue
                    payload = data.encode("utf-8")
                    while payload:
                        written = os.write(fd, payload)
                        payload = payload[written:]
            except WebSocketDisconnect:
                pass
            except Exception:
                pass

        read_task = asyncio.create_task(read_from_pty_loop())
        ws_task = asyncio.create_task(receive_from_ws_loop())

        done, pending = await asyncio.wait(
            [read_task, ws_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        try:
            loop.remove_reader(fd)
        except Exception:
            pass

        for task in pending:
            task.cancel()

        # If the shell exited first, inform client and close cleanly
        if read_task in done:
            try:
                await websocket.send_text("\r\n\x1b[90m[Process completed]\x1b[0m\r\n")
                await websocket.close(code=1000)
            except Exception:
                pass

        # Cleanup process and file descriptor
        try:
            os.close(fd)
        except OSError:
            pass

        try:
            os.kill(pid, signal.SIGHUP)
        except (ProcessLookupError, OSError):
            pass

        try:
            res_pid, status = os.waitpid(pid, os.WNOHANG)
            if res_pid == 0:
                os.kill(pid, signal.SIGKILL)
                os.waitpid(pid, 0)
        except (ChildProcessError, ProcessLookupError, OSError):
            pass

