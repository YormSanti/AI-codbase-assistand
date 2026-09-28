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

    # Fork a new pty for bash
    pid, fd = pty.fork()
    if pid == 0:
        # Child process
        os.environ["TERM"] = "xterm-256color"
        
        # PyInstaller overrides LD_LIBRARY_PATH, which breaks external 
        # commands (like node). Restore the original library path.
        if "LD_LIBRARY_PATH_ORIG" in os.environ:
            os.environ["LD_LIBRARY_PATH"] = os.environ["LD_LIBRARY_PATH_ORIG"]
        else:
            os.environ.pop("LD_LIBRARY_PATH", None)

        os.chdir(cwd)
        os.execv("/bin/bash", ["bash", "-i"])
    else:
        # Parent process
        read_task = asyncio.create_task(read_from_pty(fd, websocket))
        try:
            while True:
                data = await websocket.receive_text()
                if data.startswith(RESIZE_PREFIX):
                    try:
                        cols, rows = map(int, data[len(RESIZE_PREFIX):].split(":", 1))
                        resize_pty(fd, cols, rows)
                        os.kill(pid, signal.SIGWINCH)
                    except (ValueError, ProcessLookupError):
                        pass
                    continue
                os.write(fd, data.encode("utf-8"))
        except WebSocketDisconnect:
            pass
        finally:
            read_task.cancel()
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
