"""File-scoped endpoints (symbols extracted via Tree-sitter)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import IndexingServiceDep
from app.api.schemas import CodeSymbolResponse
from app.domain.exceptions import IndexedFileNotFoundError

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/{file_id}/symbols", response_model=list[CodeSymbolResponse])
def get_file_symbols(file_id: int, service: IndexingServiceDep) -> list[CodeSymbolResponse]:
    try:
        symbols = service.get_symbols(file_id)
    except IndexedFileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [CodeSymbolResponse.from_domain(s) for s in symbols]
