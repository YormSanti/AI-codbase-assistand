"""Entry point used by the packaged Tauri backend sidecar."""

import os

import uvicorn

from app.main import app


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.environ.get("DEVPILOT_PORT", "8000")),
        log_level=os.environ.get("DEVPILOT_LOG_LEVEL", "warning"),
    )
