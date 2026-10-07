"""Local Code Editor endpoints; ignored files never enter the shared index."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import LocalEditorServiceDep
from app.api.schemas import CodeSymbolResponse, FilePreviewResponse, SaveFileRequest, TreeNodeResponse
from app.domain.exceptions import FileEditConflictError, FileEditError, IndexedFileNotFoundError, RepositoryNotFoundError

router = APIRouter(prefix="/api/repositories/{repository_id}/editor", tags=["editor"])


@router.get("/tree", response_model=TreeNodeResponse)
def get_tree(repository_id: int, service: LocalEditorServiceDep) -> TreeNodeResponse:
    try:
        return TreeNodeResponse.from_domain(service.get_tree(repository_id))
    except (RepositoryNotFoundError, IndexedFileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/content", response_model=FilePreviewResponse)
def get_content(repository_id: int, path: str, service: LocalEditorServiceDep) -> FilePreviewResponse:
    try:
        return FilePreviewResponse.from_domain(service.get_content(repository_id, path))
    except (RepositoryNotFoundError, IndexedFileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/content", response_model=FilePreviewResponse)
def save_content(repository_id: int, path: str, request: SaveFileRequest, service: LocalEditorServiceDep) -> FilePreviewResponse:
    try:
        return FilePreviewResponse.from_domain(service.save_content(repository_id, path, request.content, request.expected_hash))
    except (RepositoryNotFoundError, IndexedFileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileEditConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except FileEditError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/symbols", response_model=list[CodeSymbolResponse])
def get_symbols(repository_id: int, path: str, service: LocalEditorServiceDep) -> list[CodeSymbolResponse]:
    try:
        return [CodeSymbolResponse.from_domain(symbol) for symbol in service.get_symbols(repository_id, path)]
    except (RepositoryNotFoundError, IndexedFileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
