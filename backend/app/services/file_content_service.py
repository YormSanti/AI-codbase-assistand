"""Bounded local file reads and version-checked atomic saves shared by both editors."""
from __future__ import annotations

from dataclasses import replace
import hashlib
import os
from pathlib import Path
import stat
import tempfile
from threading import RLock

from app.domain.exceptions import FileEditConflictError, FileEditError, IndexedFileNotFoundError
from app.domain.models import FileMetadata, FilePreview

MAX_EDIT_BYTES = 512_000
FILE_EDIT_LOCK = RLock()


def preview_file(file: FileMetadata, root: Path, absolute_path: Path, max_bytes: int = MAX_EDIT_BYTES) -> FilePreview:
    assert file.id is not None
    try:
        file_stat = absolute_path.stat()
        if file.is_binary:
            return FilePreview(
                file.id, file.relative_path, None, is_binary=True,
                size_bytes=file_stat.st_size,
                editing_disabled_reason="Binary files cannot be edited.",
            )
        with absolute_path.open("rb") as source:
            raw = source.read(max_bytes + 1)
    except OSError as exc:
        raise IndexedFileNotFoundError(
            f"Indexed file id={file.id} could not be read"
        ) from exc

    truncated = len(raw) > max_bytes
    reason = None
    try:
        content = raw[:max_bytes].decode("utf-8")
    except UnicodeDecodeError:
        content = raw[:max_bytes].decode("utf-8", errors="replace")
        reason = "Only UTF-8 text files can be edited."
    if b"\x00" in raw:
        reason = "Binary files cannot be edited."
    if truncated:
        reason = "Files larger than 500 KB cannot be edited."
    if absolute_path != root / file.relative_path:
        reason = "Symbolic links cannot be edited."
    if not file_stat.st_mode & (stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH):
        reason = "This file is read-only."
    return FilePreview(
        file_id=file.id,
        path=file.relative_path,
        content=content,
        is_binary=False,
        truncated=truncated,
        content_hash=hashlib.sha256(raw).hexdigest() if not truncated else None,
        size_bytes=file_stat.st_size,
        editable=reason is None,
        editing_disabled_reason=reason,
    )


def save_file(file: FileMetadata, root: Path, absolute_path: Path, content: str, expected_hash: str) -> FilePreview:
    try:
        raw = content.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise FileEditError("Only valid UTF-8 text can be saved.") from exc
    if len(raw) > MAX_EDIT_BYTES:
        raise FileEditError("Files larger than 500 KB cannot be saved in the editor.")
    if b"\x00" in raw:
        raise FileEditError("Binary content cannot be saved in the text editor.")

    preview = preview_file(file, root, absolute_path, MAX_EDIT_BYTES)
    if not preview.editable:
        raise FileEditError(preview.editing_disabled_reason or "This file cannot be edited.")
    if preview.content_hash != expected_hash:
        raise FileEditConflictError(
            "This file changed on disk. Copy your edits, then reload the file before saving."
        )
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=absolute_path.parent, delete=False) as target:
            temporary_path = Path(target.name)
            target.write(raw)
            target.flush()
            os.fsync(target.fileno())
        temporary_path.chmod(stat.S_IMODE(absolute_path.stat().st_mode))
        # Check again before replacement in case an external editor saved meanwhile.
        with absolute_path.open("rb") as current:
            current_hash = hashlib.sha256(current.read(MAX_EDIT_BYTES + 1)).hexdigest()
        if current_hash != expected_hash:
            raise FileEditConflictError("This file changed on disk. Reload it before saving.")
        os.replace(temporary_path, absolute_path)
    except OSError as exc:
        raise FileEditError("Could not save this file. Check its permissions and try again.") from exc
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return preview_file(replace(file, is_binary=False), root, absolute_path)
