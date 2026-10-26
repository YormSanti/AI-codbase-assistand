"""Live Git status and diff endpoints, plus explicit stage, unstage, and commit actions."""
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import GitReviewServiceDep
from app.api.schemas import GitCommitRequest, GitPathsRequest
from app.domain.exceptions import GitCommandError, GitReviewError, NotAGitRepositoryError, RepositoryNotFoundError
from app.domain.git_models import GitDiff, GitStatus

router = APIRouter(prefix="/api/repositories", tags=["git"])


@router.get("/{repository_id}/git", response_model=GitStatus)
def get_git_status(repository_id: int, service: GitReviewServiceDep) -> GitStatus:
    try:
        return service.get_status(repository_id)
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NotAGitRepositoryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GitReviewError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/{repository_id}/git/diff", response_model=GitDiff)
def get_git_diff(
    repository_id: int,
    service: GitReviewServiceDep,
    path: Annotated[str, Query(min_length=1)],
    staged: bool = False,
) -> GitDiff:
    try:
        return service.get_diff(repository_id, path, staged)
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NotAGitRepositoryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GitReviewError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


def _run_action(action):
    try:
        return action()
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NotAGitRepositoryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (GitReviewError, GitCommandError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{repository_id}/git/stage", response_model=GitStatus)
def stage_changes(repository_id: int, request: GitPathsRequest, service: GitReviewServiceDep) -> GitStatus:
    return _run_action(lambda: service.stage(repository_id, request.paths))


@router.post("/{repository_id}/git/unstage", response_model=GitStatus)
def unstage_changes(repository_id: int, request: GitPathsRequest, service: GitReviewServiceDep) -> GitStatus:
    return _run_action(lambda: service.unstage(repository_id, request.paths))


@router.post("/{repository_id}/git/commit", response_model=GitStatus)
def commit_changes(repository_id: int, request: GitCommitRequest, service: GitReviewServiceDep) -> GitStatus:
    return _run_action(lambda: service.commit(repository_id, request.message))
