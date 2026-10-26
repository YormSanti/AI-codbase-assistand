"""Code Editor's live filesystem view, independent of the filtered AI index."""
from __future__ import annotations

from dataclasses import replace
from collections.abc import Callable
import hashlib
import os
from pathlib import Path
import time

from app.domain.exceptions import IndexedFileNotFoundError, RepositoryNotFoundError
from app.domain.models import CodeSymbol, FileMetadata, FilePreview, Language, SearchMatch, SearchResults, TreeNode
from app.domain.ports import CodeParserPort, FileMetadataRepositoryPort
from app.services.file_content_service import FILE_EDIT_LOCK, preview_file, save_file


# Dependency and build output folders are skipped by project-wide search; they
# dominate scan time and almost never hold what the user is looking for.
SEARCH_SKIPPED_DIRECTORIES = frozenset({
    ".git", ".hg", ".svn", "node_modules", ".venv", "venv", "__pycache__", ".mypy_cache",
    ".pytest_cache", ".ruff_cache", "dist", "build", "target", ".next", ".nuxt", ".cache",
    ".turbo", ".parcel-cache", "coverage", ".idea", ".vscode",
})
SEARCH_MAX_FILE_BYTES = 512_000
SEARCH_MAX_FILES = 20_000
SEARCH_TIME_BUDGET_SECONDS = 6.0
SEARCH_MAX_MATCHES = 500
SEARCH_SNIPPET_CHARS = 200


def local_file_id(path: str) -> int:
    # Stable negative IDs distinguish editor-only files from persisted files.
    # 52 bits fit exactly in a JavaScript number.
    return -(int(hashlib.sha256(path.encode()).hexdigest()[:13], 16) + 1)


class LocalEditorService:
    def __init__(self, files: FileMetadataRepositoryPort, parser: CodeParserPort,
                 detect_language: Callable[[str], Language], is_binary_extension: Callable[[str], bool]) -> None:
        self._files = files
        self._parser = parser
        self._detect_language = detect_language
        self._is_binary_extension = is_binary_extension

    def _root(self, repository_id: int) -> Path:
        repository = self._files.get_repository(repository_id)
        if repository is None:
            raise RepositoryNotFoundError(f"No repository with id={repository_id}")
        root = Path(repository.root_path).resolve()
        if not root.is_dir():
            raise IndexedFileNotFoundError("The project folder is no longer available.")
        return root

    def get_tree(self, repository_id: int) -> TreeNode:
        root = self._root(repository_id)
        indexed = {file.relative_path: file for file in self._files.list_files(repository_id)}
        directories: dict[str, TreeNode] = {
            "": TreeNode(name=root.name, path="", is_directory=True),
        }
        # No Git, dotfile, build, or dependency filters. Listing only stats files;
        # their contents are read on selection. Never traverse directory symlinks.
        for current, dirs, files in os.walk(root, followlinks=False):
            relative = Path(current).relative_to(root).as_posix()
            relative = "" if relative == "." else relative
            parent = directories[relative]
            for name in dirs:
                path = f"{relative}/{name}" if relative else name
                node = TreeNode(name=name, path=path, is_directory=True)
                directories[path] = node
                parent.children.append(node)
            for name in files:
                path = f"{relative}/{name}" if relative else name
                try:
                    file_stat = (root / path).lstat()
                except OSError:
                    continue
                known = indexed.get(path)
                parent.children.append(TreeNode(
                    name=name, path=path, is_directory=False,
                    language=self._detect_language(path), size_bytes=file_stat.st_size,
                    file_id=known.id if known else local_file_id(path),
                ))
        for node in directories.values():
            node.children.sort(key=lambda child: (not child.is_directory, child.name.lower()))
        return directories[""]

    def _resolve(self, repository_id: int, path: str) -> tuple[FileMetadata, Path, Path]:
        root = self._root(repository_id)
        relative = Path(path)
        if not path or relative.is_absolute() or ".." in relative.parts:
            raise IndexedFileNotFoundError("Choose a file inside the project folder.")
        try:
            absolute = (root / relative).resolve()
            if not absolute.is_relative_to(root) or not absolute.is_file():
                raise IndexedFileNotFoundError("This local file is no longer available.")
            file = FileMetadata(
                id=local_file_id(path), repository_id=repository_id, relative_path=path,
                language=self._detect_language(path), size_bytes=absolute.stat().st_size,
                content_hash="", is_binary=self._is_binary_extension(path),
            )
        except (OSError, RuntimeError) as exc:
            raise IndexedFileNotFoundError("This local file could not be opened.") from exc
        return file, root, absolute

    def search(self, repository_id: int, query: str, *, limit: int = 200, case_sensitive: bool = False) -> SearchResults:
        """Plain-text search across the project's text files, bounded in matches, files, and time."""
        root = self._root(repository_id)
        needle = query if case_sensitive else query.lower()
        if not needle.strip():
            return SearchResults(query, [], 0)
        limit = max(1, min(limit, SEARCH_MAX_MATCHES))
        matches: list[SearchMatch] = []
        scanned = 0
        truncated = False
        deadline = time.monotonic() + SEARCH_TIME_BUDGET_SECONDS
        for current, dirs, files in os.walk(root, followlinks=False):
            dirs[:] = sorted(name for name in dirs if name not in SEARCH_SKIPPED_DIRECTORIES)
            relative = Path(current).relative_to(root).as_posix()
            relative = "" if relative == "." else relative
            for name in sorted(files):
                if scanned >= SEARCH_MAX_FILES or time.monotonic() > deadline:
                    return SearchResults(query, matches, scanned, truncated=True)
                path = f"{relative}/{name}" if relative else name
                if self._is_binary_extension(path):
                    continue
                target = root / path
                try:
                    if target.is_symlink() or not target.is_file() or target.stat().st_size > SEARCH_MAX_FILE_BYTES:
                        continue
                    raw = target.read_bytes()
                except OSError:
                    continue
                scanned += 1
                if b"\0" in raw[:8192]:
                    continue
                text = raw.decode("utf-8", errors="replace")
                haystack = text if case_sensitive else text.lower()
                if needle not in haystack:
                    continue
                for number, (line, folded) in enumerate(zip(text.splitlines(), haystack.splitlines()), start=1):
                    column = folded.find(needle)
                    if column == -1:
                        continue
                    matches.append(SearchMatch(path, number, column + 1, _snippet(line, column, len(needle))))
                    if len(matches) >= limit:
                        return SearchResults(query, matches, scanned, truncated=True)
        return SearchResults(query, matches, scanned, truncated)

    def get_content(self, repository_id: int, path: str) -> FilePreview:
        with FILE_EDIT_LOCK:
            return preview_file(*self._resolve(repository_id, path))

    def save_content(self, repository_id: int, path: str, content: str, expected_hash: str) -> FilePreview:
        with FILE_EDIT_LOCK:
            return save_file(*self._resolve(repository_id, path), content, expected_hash)

    def get_symbols(self, repository_id: int, path: str) -> list[CodeSymbol]:
        file, _, _ = self._resolve(repository_id, path)
        preview = self.get_content(repository_id, path)
        if preview.is_binary or preview.truncated or not preview.content or not self._parser.supports(file.language):
            return []
        symbols = self._parser.parse(preview.content.encode("utf-8"), file.language)
        return [replace(symbol, id=index + 1) for index, symbol in enumerate(symbols)]


def _snippet(line: str, column: int, length: int) -> str:
    """Keep the match visible inside a bounded excerpt of a long line."""
    if len(line) <= SEARCH_SNIPPET_CHARS:
        return line
    start = max(0, column - SEARCH_SNIPPET_CHARS // 3)
    end = min(len(line), max(start + SEARCH_SNIPPET_CHARS, column + length))
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(line) else ""
    return f"{prefix}{line[start:end]}{suffix}"
