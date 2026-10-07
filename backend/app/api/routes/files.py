"""File content previews, version-checked edits, and extracted symbols."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import IndexingServiceDep
from app.api.schemas import CodeSymbolResponse, FilePreviewResponse, SaveFileRequest
from app.domain.exceptions import FileEditConflictError, FileEditError, IndexedFileNotFoundError

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/{file_id}/content", response_model=FilePreviewResponse)
def get_file_content(file_id: int, service: IndexingServiceDep) -> FilePreviewResponse:
    try:
        preview = service.get_file_preview(file_id)
    except IndexedFileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FilePreviewResponse.from_domain(preview)


@router.put("/{file_id}/content", response_model=FilePreviewResponse)
def save_file_content(
    file_id: int, request: SaveFileRequest, service: IndexingServiceDep
) -> FilePreviewResponse:
    try:
        preview = service.save_file_content(file_id, request.content, request.expected_hash)
    except IndexedFileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileEditConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except FileEditError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FilePreviewResponse.from_domain(preview)


@router.get("/{file_id}/symbols", response_model=list[CodeSymbolResponse])
def get_file_symbols(file_id: int, service: IndexingServiceDep) -> list[CodeSymbolResponse]:
    try:
        symbols = service.get_symbols(file_id)
    except IndexedFileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [CodeSymbolResponse.from_domain(s) for s in symbols]
