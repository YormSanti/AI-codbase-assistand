"""Repository indexing endpoints."""
from __future__ import annotations

import os
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.deps import IndexingServiceDep
from app.api.schemas import OpenRepositoryRequest, RepositoryResponse, TreeNodeResponse
from app.domain.exceptions import NotAGitRepositoryError, RepositoryNotFoundError
from app.domain.models import SymbolMatch

router = APIRouter(prefix="/api/repositories", tags=["repositories"])


def _project_path(raw: str) -> str:
    """Trim the whitespace and quotes that "Copy as path" adds, and insist on a full path.

    A relative path would resolve against the backend's own working folder,
    which means nothing to the person typing it.
    """
    path = raw.strip()
    if len(path) >= 2 and path[0] == path[-1] and path[0] in "'\"":
        path = path[1:-1].strip()
    if not path:
        raise HTTPException(status_code=400, detail="Enter the folder to open.")
    if not os.path.isabs(os.path.expanduser(path)):
        raise HTTPException(status_code=400, detail=f"Enter the full path to the folder, for example {os.path.expanduser('~')}/projects/app, not '{path}'.")
    return path


@router.post("/open", response_model=RepositoryResponse)
def open_repository(request: OpenRepositoryRequest, service: IndexingServiceDep) -> RepositoryResponse:
    try:
        info = service.open_repository(_project_path(request.path))
    except NotAGitRepositoryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RepositoryResponse.from_domain(info)


@router.get("", response_model=list[RepositoryResponse])
def list_repositories(service: IndexingServiceDep) -> list[RepositoryResponse]:
    return [RepositoryResponse.from_domain(info) for info in service.list_repositories()]


@router.get("/{repository_id}", response_model=RepositoryResponse)
def get_repository(repository_id: int, service: IndexingServiceDep) -> RepositoryResponse:
    try:
        info = service.get_repository(repository_id)
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RepositoryResponse.from_domain(info)


@router.post("/{repository_id}/reindex", response_model=RepositoryResponse)
def reindex_repository(repository_id: int, service: IndexingServiceDep) -> RepositoryResponse:
    """Rescan the working tree and rebuild symbols for every file."""
    try:
        info = service.reindex_repository(repository_id)
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NotAGitRepositoryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RepositoryResponse.from_domain(info)


@router.delete("/{repository_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_repository(repository_id: int, service: IndexingServiceDep) -> Response:
    try:
        service.delete_repository(repository_id)
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{repository_id}/tree", response_model=TreeNodeResponse)
def get_repository_tree(repository_id: int, service: IndexingServiceDep) -> TreeNodeResponse:
    try:
        tree = service.get_tree(repository_id)
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return TreeNodeResponse.from_domain(tree)


@router.get("/{repository_id}/symbols", response_model=list[SymbolMatch])
def search_symbols(
    repository_id: int,
    service: IndexingServiceDep,
    q: Annotated[str, Query(min_length=1, max_length=200)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[SymbolMatch]:
    """Indexed classes, functions, and methods whose name contains `q` (case-insensitive)."""
    try:
        return service.search_symbols(repository_id, q, limit)
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
