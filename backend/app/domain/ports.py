"""Ports (abstract interfaces) the domain/services depend on.

Following the Dependency Inversion Principle, `IndexingService` depends only
on these abstractions, never on GitPython or SQLAlchemy directly. Concrete
adapters live in `app.infrastructure.*` and are wired together in
`app.api.deps` via FastAPI's dependency injection.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.models import FileMetadata, RepositoryInfo


class GitClientPort(ABC):
    """Reads metadata out of a Git working tree."""

    @abstractmethod
    def open(self, path: str) -> RepositoryInfo:
        """Validate `path` is a Git repo and return its basic metadata."""

    @abstractmethod
    def list_tracked_files(self, path: str) -> list[str]:
        """Return repo-relative paths for tracked + untracked-but-not-ignored files."""


class FileMetadataRepositoryPort(ABC):
    """Persists repositories and their indexed files."""

    @abstractmethod
    def save_repository(self, info: RepositoryInfo) -> RepositoryInfo:
        """Insert or update a repository record; returns it with an id set."""

    @abstractmethod
    def get_repository(self, repository_id: int) -> RepositoryInfo | None: ...

    @abstractmethod
    def find_repository_by_path(self, root_path: str) -> RepositoryInfo | None: ...

    @abstractmethod
    def list_repositories(self) -> list[RepositoryInfo]: ...

    @abstractmethod
    def replace_files(self, repository_id: int, files: list[FileMetadata]) -> list[FileMetadata]:
        """Atomically replace all indexed files for a repository (re-index)."""

    @abstractmethod
    def list_files(self, repository_id: int) -> list[FileMetadata]: ...
