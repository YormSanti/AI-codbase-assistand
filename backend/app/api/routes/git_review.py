"""Live Git status and diff endpoints, plus explicit stage, unstage, and commit actions."""
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import GitReviewServiceDep
from app.api.schemas import GitCommitRequest, GitCreateBranchRequest, GitPathsRequest, GitSwitchBranchRequest
from app.domain.exceptions import GitCommandError, GitReviewError, NotAGitRepositoryError, RepositoryNotFoundError
from app.domain.git_models import BranchList, CommitDetails, GitDiff, GitStatus, StagedDiff

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


@router.get("/{repository_id}/git/commits/{sha}", response_model=CommitDetails)
def get_commit(repository_id: int, sha: str, service: GitReviewServiceDep) -> CommitDetails:
    """Message, author, parents, and changed files (with line counts) of one commit."""
    return _run_action(lambda: service.get_commit(repository_id, sha))


@router.get("/{repository_id}/git/commits/{sha}/diff", response_model=GitDiff)
def get_commit_diff(
    repository_id: int,
    sha: str,
    service: GitReviewServiceDep,
    path: Annotated[str, Query(min_length=1)],
) -> GitDiff:
    """One changed file's patch within a commit, compared with its first parent."""
    return _run_action(lambda: service.get_commit_diff(repository_id, sha, path))


@router.get("/{repository_id}/git/staged-diff", response_model=StagedDiff)
def get_staged_diff(repository_id: int, service: GitReviewServiceDep) -> StagedDiff:
    """Combined patch, stat, and file count of everything staged for the next commit."""
    return _run_action(lambda: service.get_staged_diff(repository_id))


@router.post("/{repository_id}/git/stage", response_model=GitStatus)
def stage_changes(repository_id: int, request: GitPathsRequest, service: GitReviewServiceDep) -> GitStatus:
    return _run_action(lambda: service.stage(repository_id, request.paths))


@router.post("/{repository_id}/git/unstage", response_model=GitStatus)
def unstage_changes(repository_id: int, request: GitPathsRequest, service: GitReviewServiceDep) -> GitStatus:
    return _run_action(lambda: service.unstage(repository_id, request.paths))


@router.get("/{repository_id}/git/branches", response_model=BranchList)
def list_branches(repository_id: int, service: GitReviewServiceDep) -> BranchList:
    """Local branches, most recently committed first, and the checked-out branch."""
    return _run_action(lambda: service.list_branches(repository_id))


@router.post("/{repository_id}/git/branches", response_model=GitStatus)
def create_branch(repository_id: int, request: GitCreateBranchRequest, service: GitReviewServiceDep) -> GitStatus:
    """Create a branch at HEAD and, by default, switch to it."""
    return _run_action(lambda: service.create_branch(repository_id, request.name, request.checkout))


@router.post("/{repository_id}/git/checkout", response_model=GitStatus)
def switch_branch(repository_id: int, request: GitSwitchBranchRequest, service: GitReviewServiceDep) -> GitStatus:
    """Check out an existing local branch. Refused while tracked files have changes."""
    return _run_action(lambda: service.switch_branch(repository_id, request.branch))


@router.post("/{repository_id}/git/fetch", response_model=GitStatus)
def fetch(repository_id: int, service: GitReviewServiceDep) -> GitStatus:
    """Fetch all remotes (with prune) and return the refreshed status, including behind counts."""
    return _run_action(lambda: service.fetch(repository_id))


@router.post("/{repository_id}/git/pull", response_model=GitStatus)
def pull(repository_id: int, service: GitReviewServiceDep) -> GitStatus:
    """Fast-forward the current branch to its upstream; fails instead of merging diverged history."""
    return _run_action(lambda: service.pull(repository_id))


@router.post("/{repository_id}/git/push", response_model=GitStatus)
def push(repository_id: int, service: GitReviewServiceDep) -> GitStatus:
    """Push the current branch, setting its upstream on the first push. Never forces."""
    return _run_action(lambda: service.push(repository_id))


@router.post("/{repository_id}/git/discard", response_model=GitStatus)
def discard_changes(repository_id: int, request: GitPathsRequest, service: GitReviewServiceDep) -> GitStatus:
    """Discard working-tree changes: tracked files return to their staged/committed version, untracked files are deleted."""
    return _run_action(lambda: service.discard(repository_id, request.paths))


@router.post("/{repository_id}/git/commit", response_model=GitStatus)
def commit_changes(repository_id: int, request: GitCommitRequest, service: GitReviewServiceDep) -> GitStatus:
    return _run_action(lambda: service.commit(repository_id, request.message))
