"""Repository indexing endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import IndexingServiceDep
from app.api.schemas import OpenRepositoryRequest, RepositoryResponse, TreeNodeResponse
from app.domain.exceptions import NotAGitRepositoryError, RepositoryNotFoundError

router = APIRouter(prefix="/api/repositories", tags=["repositories"])


@router.post("/open", response_model=RepositoryResponse)
def open_repository(request: OpenRepositoryRequest, service: IndexingServiceDep) -> RepositoryResponse:
    try:
        info = service.open_repository(request.path)
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


@router.get("/{repository_id}/tree", response_model=TreeNodeResponse)
def get_repository_tree(repository_id: int, service: IndexingServiceDep) -> TreeNodeResponse:
    try:
        tree = service.get_tree(repository_id)
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return TreeNodeResponse.from_domain(tree)
