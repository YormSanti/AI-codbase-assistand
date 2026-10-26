"""Ports (abstract interfaces) the domain/services depend on.

Following the Dependency Inversion Principle, `IndexingService` depends only
on these abstractions, never on GitPython or SQLAlchemy directly. Concrete
adapters live in `app.infrastructure.*` and are wired together in
`app.api.deps` via FastAPI's dependency injection.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.git_models import BranchList, CommitDetails, GitCommit, GitDiff, GitStatus, StagedDiff
from app.domain.models import CodeSymbol, FileMetadata, FileSyncResult, Language, RepositoryInfo, SymbolMatch


class GitReviewPort(ABC):
    """Read live status and diffs, and apply explicit index/commit actions.

    Reads never touch the working tree or index. Writes are limited to the
    three actions below, always on paths the user picked from the current
    status; nothing fetches, pushes, or rewrites history.
    """

    @abstractmethod
    def get_status(self, path: str) -> GitStatus: ...

    @abstractmethod
    def get_diff(self, root_path: str, path: str, staged: bool) -> GitDiff: ...

    @abstractmethod
    def get_commit(self, root_path: str, sha: str) -> CommitDetails:
        """Metadata and changed files of one commit, compared with its first parent."""

    @abstractmethod
    def get_commit_diff(self, root_path: str, sha: str, path: str) -> GitDiff:
        """One file's patch within a commit."""

    @abstractmethod
    def get_staged_diff(self, root_path: str) -> StagedDiff:
        """The combined patch and stat of everything currently staged."""

    @abstractmethod
    def stage(self, root_path: str, paths: list[str]) -> None:
        """Add the given changed paths (including deletions) to the index."""

    @abstractmethod
    def unstage(self, root_path: str, paths: list[str]) -> None:
        """Remove the given paths from the index, keeping working tree edits."""

    @abstractmethod
    def list_branches(self, root_path: str) -> BranchList:
        """Local branches and which one is checked out."""

    @abstractmethod
    def switch_branch(self, root_path: str, name: str) -> None:
        """Check out an existing local branch; refused while tracked files have changes."""

    @abstractmethod
    def create_branch(self, root_path: str, name: str, checkout: bool) -> None:
        """Create a branch at HEAD, optionally switching to it (working-tree changes come along)."""

    @abstractmethod
    def discard(self, root_path: str, paths: list[str]) -> None:
        """Throw away working-tree changes: restore tracked files from the index, delete untracked ones."""

    @abstractmethod
    def commit(self, root_path: str, message: str) -> GitCommit:
        """Commit the index with `message`; hooks and identity rules apply as in the CLI."""


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
    def delete_repository(self, repository_id: int) -> None:
        """Delete a repository and its indexed files."""

    @abstractmethod
    def sync_files(self, repository_id: int, files: list[FileMetadata]) -> FileSyncResult:
        """Reconcile the stored index with `files`.

        Unchanged files keep their ids (and symbols), changed files are
        updated in place, new files are inserted, and files missing from
        `files` are removed together with their symbols.
        """

    @abstractmethod
    def list_files(self, repository_id: int) -> list[FileMetadata]: ...

    @abstractmethod
    def get_file(self, file_id: int) -> FileMetadata | None: ...

    @abstractmethod
    def update_file(self, file: FileMetadata) -> FileMetadata:
        """Update metadata after a save, preserving the file's id."""


class CodeParserPort(ABC):
    """Extracts classes/functions/methods/imports from source code."""

    @abstractmethod
    def supports(self, language: Language) -> bool:
        """Whether this parser has a grammar for `language`."""

    @abstractmethod
    def parse(self, source: bytes, language: Language) -> list[CodeSymbol]:
        """Extract symbols from `source`. Caller guarantees `supports(language)`."""


class SymbolRepositoryPort(ABC):
    """Persists the symbols extracted from a single file."""

    @abstractmethod
    def replace_symbols(self, file_id: int, symbols: list[CodeSymbol]) -> list[CodeSymbol]:
        """Atomically replace all symbols for a file (re-parse)."""

    @abstractmethod
    def list_symbols_for_file(self, file_id: int) -> list[CodeSymbol]: ...

    @abstractmethod
    def search_symbols(self, repository_id: int, query: str, limit: int) -> list[SymbolMatch]:
        """Classes, functions, and methods whose name contains `query`, best matches first."""
