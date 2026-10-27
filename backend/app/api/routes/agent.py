"""AI assistant endpoints for the browser build (the desktop app uses Tauri commands)."""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.deps import IndexingServiceDep
from app.domain.exceptions import RepositoryNotFoundError
from app.services.agent_service import MAX_PROMPT_CHARS, ProviderStatus, provider_status, stream_agent

router = APIRouter(prefix="/api/agent", tags=["agent"])

Provider = Literal["codex", "gemini"]


class AgentRunRequest(BaseModel):
    provider: Provider
    prompt: str = Field(..., min_length=1, max_length=MAX_PROMPT_CHARS)
    repository_id: int | None = Field(None, description="Run inside this project's folder; the home folder otherwise")


@router.get("/providers", response_model=dict[str, ProviderStatus])
def get_providers() -> dict[str, ProviderStatus]:
    """Whether the Codex and Gemini CLIs are installed and signed in on this machine."""
    return {name: provider_status(name) for name in ("codex", "gemini")}


@router.post("/run")
def run_agent(request: AgentRunRequest, service: IndexingServiceDep) -> StreamingResponse:
    """Stream one CLI run as NDJSON: `chunk` events, then a final `done` or `error` event."""
    if not request.prompt.strip():
        raise HTTPException(status_code=422, detail="Enter a message for the agent.")
    if request.repository_id is None:
        directory = Path.home()
    else:
        try:
            directory = Path(service.get_repository(request.repository_id).root_path)
        except RepositoryNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not directory.is_dir():
        raise HTTPException(status_code=409, detail="The project folder is no longer available.")
    return StreamingResponse(
        stream_agent(request.provider, request.prompt.strip(), directory),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
