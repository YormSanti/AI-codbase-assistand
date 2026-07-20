"""Turns a list of repo-relative paths into `FileMetadata`.

Kept separate from `GitClient` so the two responsibilities (asking Git which
paths matter vs. reading those paths off disk) can be tested and replaced
independently.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

from app.domain.models import FileMetadata, Language
from app.infrastructure.parsing.language_map import detect_language, is_binary_extension

_BINARY_SNIFF_BYTES = 8192
_HASH_CHUNK_BYTES = 1024 * 1024


def _looks_binary(sample: bytes) -> bool:
    return b"\x00" in sample


def _hash_and_sniff(absolute_path: Path) -> tuple[str, bool]:
    """Stream the file once to compute its hash and sniff for binary content."""
    digest = hashlib.sha256()
    sniffed = b""
    with absolute_path.open("rb") as handle:
        first_chunk = True
        while chunk := handle.read(_HASH_CHUNK_BYTES):
            digest.update(chunk)
            if first_chunk:
                sniffed = chunk[:_BINARY_SNIFF_BYTES]
                first_chunk = False
    return digest.hexdigest(), _looks_binary(sniffed)


def scan_files(root_path: str, relative_paths: list[str]) -> list[FileMetadata]:
    """Read metadata for each relative path under `root_path`.

    Paths that no longer exist on disk (e.g. race with a concurrent git
    operation) or cannot be read are silently skipped rather than failing
    the whole index — a single broken symlink shouldn't block indexing.
    Files are streamed in chunks rather than loaded fully into memory so a
    large binary asset can't blow up indexing.
    """
    root = Path(root_path)
    results: list[FileMetadata] = []

    for relative_path in relative_paths:
        absolute_path = root / relative_path
        try:
            if not absolute_path.is_file():
                continue
            size_bytes = absolute_path.stat().st_size
            content_hash, sniffed_binary = _hash_and_sniff(absolute_path)
        except OSError:
            continue

        is_binary = is_binary_extension(relative_path) or sniffed_binary
        language = Language.OTHER if is_binary else detect_language(relative_path)

        results.append(
            FileMetadata(
                relative_path=relative_path,
                size_bytes=size_bytes,
                language=language,
                content_hash=content_hash,
                is_binary=is_binary,
            )
        )

    return results
