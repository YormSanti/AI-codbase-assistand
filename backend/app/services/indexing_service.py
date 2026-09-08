"""Application service orchestrating repository indexing.

Depends only on the `GitClientPort` / `FileMetadataRepositoryPort`
abstractions, a scanner callable, and `SymbolExtractionService` — never on
GitPython or SQLAlchemy directly, so it can be unit tested with fakes and
swapped onto different infrastructure later without changes here.
"""
from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from app.domain.exceptions import IndexedFileNotFoundError, RepositoryNotFoundError
from app.domain.models import CodeSymbol, FileMetadata, FilePreview, RepositoryInfo, TreeNode
from app.domain.ports import FileMetadataRepositoryPort, GitClientPort
from app.domain.tree_builder import build_tree
from app.services.parsing_service import SymbolExtractionService

FileScanner = Callable[[str, list[str]], list[FileMetadata]]


class IndexingService:
    def __init__(
        self,
        git_client: GitClientPort,
        file_repository: FileMetadataRepositoryPort,
        scan_files: FileScanner,
        symbol_extraction_service: SymbolExtractionService,
    ) -> None:
        self._git_client = git_client
        self._file_repository = file_repository
        self._scan_files = scan_files
        self._symbol_extraction_service = symbol_extraction_service

    def open_repository(self, path: str) -> RepositoryInfo:
        """Open (or re-index, if already known) a Git repository at `path`."""
        info = self._git_client.open(path)
        saved = self._file_repository.save_repository(info)

        relative_paths = self._git_client.list_tracked_files(saved.root_path)
        files = self._scan_files(saved.root_path, relative_paths)
        indexed = self._file_repository.replace_files(saved.id, files)

        for file in indexed:
            self._symbol_extraction_service.extract_and_store(file, saved.root_path)

        return RepositoryInfo(
            id=saved.id,
            name=saved.name,
            root_path=saved.root_path,
            current_branch=saved.current_branch,
            head_commit=saved.head_commit,
            opened_at=saved.opened_at,
            file_count=len(indexed),
        )

    def list_repositories(self) -> list[RepositoryInfo]:
        return self._file_repository.list_repositories()

    def get_repository(self, repository_id: int) -> RepositoryInfo:
        info = self._file_repository.get_repository(repository_id)
        if info is None:
            raise RepositoryNotFoundError(f"No repository with id={repository_id}")
        return info

    def get_tree(self, repository_id: int) -> TreeNode:
        info = self.get_repository(repository_id)
        files = self._file_repository.list_files(repository_id)
        return build_tree(info.name, files)

    def get_symbols(self, file_id: int) -> list[CodeSymbol]:
        if self._file_repository.get_file(file_id) is None:
            raise IndexedFileNotFoundError(f"No file with id={file_id}")
        return self._symbol_extraction_service.list_for_file(file_id)

    def get_file_preview(self, file_id: int, max_bytes: int = 512_000) -> FilePreview:
        """Return a bounded text preview without allowing paths outside the repository."""
        file = self._file_repository.get_file(file_id)
        if file is None or file.repository_id is None:
            raise IndexedFileNotFoundError(f"No file with id={file_id}")

        repository = self.get_repository(file.repository_id)
        root = Path(repository.root_path).resolve()
        absolute_path = (root / file.relative_path).resolve()
        if not absolute_path.is_relative_to(root) or not absolute_path.is_file():
            raise IndexedFileNotFoundError(f"Indexed file id={file_id} is no longer available")

        if file.is_binary:
            return FilePreview(file_id, file.relative_path, None, is_binary=True)

        try:
            with absolute_path.open("rb") as source:
                raw = source.read(max_bytes + 1)
        except OSError as exc:
            raise IndexedFileNotFoundError(
                f"Indexed file id={file_id} could not be read"
            ) from exc

        truncated = len(raw) > max_bytes
        content = raw[:max_bytes].decode("utf-8", errors="replace")
        return FilePreview(
            file_id=file_id,
            path=file.relative_path,
            content=content,
            is_binary=False,
            truncated=truncated,
        )
