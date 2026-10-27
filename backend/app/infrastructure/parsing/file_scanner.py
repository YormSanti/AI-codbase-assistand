"""Turns a list of repo-relative paths into `FileMetadata`.

Kept separate from `GitClient` so the two responsibilities (asking Git which
paths matter vs. reading those paths off disk) can be tested and replaced
independently.
"""
from __future__ import annotations

from collections.abc import Mapping
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


def scan_files(
    root_path: str,
    relative_paths: list[str],
    known: Mapping[str, FileMetadata] | None = None,
) -> list[FileMetadata]:
    """Read metadata for each relative path under `root_path`.

    Paths that no longer exist on disk (e.g. race with a concurrent git
    operation) or cannot be read are silently skipped rather than failing
    the whole index — a single broken symlink shouldn't block indexing.
    Files are streamed in chunks rather than loaded fully into memory so a
    large binary asset can't blow up indexing.

    `known` holds the previously indexed metadata by path. A file whose size
    and modification time match its known entry keeps that entry's hash and
    binary flag without being read, which is what makes reopening a large
    project cheap.
    """
    root = Path(root_path)
    results: list[FileMetadata] = []

    for relative_path in relative_paths:
        absolute_path = root / relative_path
        try:
            if not absolute_path.is_file():
                continue
            file_stat = absolute_path.stat()
            size_bytes = file_stat.st_size
            previous = known.get(relative_path) if known else None
            if (
                previous is not None
                and previous.mtime_ns is not None
                and previous.mtime_ns == file_stat.st_mtime_ns
                and previous.size_bytes == size_bytes
                and previous.content_hash
            ):
                content_hash, sniffed_binary = previous.content_hash, previous.is_binary
            else:
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
                mtime_ns=file_stat.st_mtime_ns,
            )
        )

    return results
