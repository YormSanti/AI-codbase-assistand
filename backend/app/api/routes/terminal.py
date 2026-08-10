import os
import pty
import asyncio
import signal
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/ws", tags=["terminal"])

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
    
    # Fork a new pty for bash
    pid, fd = pty.fork()
    if pid == 0:
        # Child process
        os.environ["TERM"] = "xterm-256color"
        os.environ["HOME"] = os.path.expanduser("~")
        os.chdir("/home/ksk/AI-Git-assistand")
        os.execv("/bin/bash", ["bash", "-i"])
    else:
        # Parent process
        read_task = asyncio.create_task(read_from_pty(fd, websocket))
        try:
            while True:
                data = await websocket.receive_text()
                os.write(fd, data.encode("utf-8"))
        except WebSocketDisconnect:
            pass
        finally:
            read_task.cancel()
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
