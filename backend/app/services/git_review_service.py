"""Resolve selected projects before reading live Git data."""
from app.domain.exceptions import RepositoryNotFoundError
from app.domain.git_models import GitDiff, GitStatus
from app.domain.ports import FileMetadataRepositoryPort, GitReviewPort


class GitReviewService:
    def __init__(self, repositories: FileMetadataRepositoryPort, git: GitReviewPort) -> None:
        self._repositories = repositories
        self._git = git

    def _root(self, repository_id: int) -> str:
        repository = self._repositories.get_repository(repository_id)
        if repository is None:
            raise RepositoryNotFoundError(f"No repository with id={repository_id}")
        return repository.root_path

    def get_status(self, repository_id: int) -> GitStatus:
        return self._git.get_status(self._root(repository_id))

    def get_diff(self, repository_id: int, path: str, staged: bool) -> GitDiff:
        return self._git.get_diff(self._root(repository_id), path, staged)
