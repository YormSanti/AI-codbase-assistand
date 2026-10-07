import os
import pty
import asyncio
import fcntl
import signal
import struct
import termios
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/ws", tags=["terminal"])

RESIZE_PREFIX = "\0DEVPILOT_RESIZE:"


def resize_pty(fd: int, cols: int, rows: int) -> None:
    if cols < 1 or rows < 1:
        return
    window_size = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, window_size)

async def read_from_pty(fd, websocket: WebSocket):
    loop = asyncio.get_running_loop()
    try:
        while True:
            # Read from PTY file descriptor
            data = await loop.run_in_executor(None, os.read, fd, 1024)
            if not data:
                break
            await websocket.send_text(data.decode("utf-8", "replace"))
    except Exception:
        pass

@router.websocket("/terminal")
async def terminal_websocket(websocket: WebSocket):
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

        # Prepend standard user bin directories to PATH if missing
        home = Path.home()
        extra_bins = [
            str(home / ".local" / "bin"),
            str(home / ".cargo" / "bin"),
            str(home / ".bun" / "bin"),
            str(home / "go" / "bin"),
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
        ]
        current_path_list = [p for p in os.environ.get("PATH", "").split(os.pathsep) if p]
        for extra_bin in reversed(extra_bins):
            if os.path.isdir(extra_bin) and extra_bin not in current_path_list:
                current_path_list.insert(0, extra_bin)
        os.environ["PATH"] = os.pathsep.join(current_path_list)

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

        # Launch login interactive shell (e.g. bash -l -i)
        try:
            os.execv(user_shell, [shell_name, "-l", "-i"])
        except Exception:
            os.execv("/bin/sh", ["sh", "-i"])
    else:
        # Parent process: set initial dimensions immediately
        try:
            resize_pty(fd, cols, rows)
        except Exception:
            pass

        async def read_from_pty_loop():
            loop = asyncio.get_running_loop()
            try:
                while True:
                    data = await loop.run_in_executor(None, os.read, fd, 2048)
                    if not data:
                        break
                    await websocket.send_text(data.decode("utf-8", "replace"))
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
                    os.write(fd, data.encode("utf-8"))
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

