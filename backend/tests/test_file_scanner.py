from pathlib import Path

from app.domain.models import Language
from app.infrastructure.parsing.file_scanner import scan_files


def test_scan_files_detects_language_size_and_hash(tmp_path: Path) -> None:
    (tmp_path / "main.py").write_text("print('hi')\n")

    [metadata] = scan_files(str(tmp_path), ["main.py"])

    assert metadata.relative_path == "main.py"
    assert metadata.language == Language.PYTHON
    assert metadata.size_bytes == len("print('hi')\n")
    assert metadata.is_binary is False
    assert len(metadata.content_hash) == 64  # sha256 hex digest


def test_scan_files_flags_binary_content(tmp_path: Path) -> None:
    (tmp_path / "blob.dat").write_bytes(b"\x00\x01\x02binary")

    [metadata] = scan_files(str(tmp_path), ["blob.dat"])

    assert metadata.is_binary is True
    assert metadata.language == Language.OTHER


def test_scan_files_skips_missing_paths(tmp_path: Path) -> None:
    results = scan_files(str(tmp_path), ["does_not_exist.py"])

    assert results == []


def test_scan_files_unknown_extension_defaults_to_other(tmp_path: Path) -> None:
    (tmp_path / "data.xyz").write_text("hello")

    [metadata] = scan_files(str(tmp_path), ["data.xyz"])

    assert metadata.language == Language.OTHER
    assert metadata.is_binary is False


def test_scan_files_reuses_known_hash_when_size_and_mtime_match(tmp_path: Path, monkeypatch) -> None:
    import os
    from app.infrastructure.parsing import file_scanner

    (tmp_path / "main.py").write_text("print('hi')\n")
    [first] = scan_files(str(tmp_path), ["main.py"])
    assert first.mtime_ns is not None

    calls: list[Path] = []
    original = file_scanner._hash_and_sniff
    monkeypatch.setattr(file_scanner, "_hash_and_sniff", lambda path: calls.append(path) or original(path))

    [again] = scan_files(str(tmp_path), ["main.py"], {"main.py": first})
    assert again.content_hash == first.content_hash
    assert calls == []  # unchanged size + mtime: not read again

    # Same size, newer timestamp: re-hashed (content may differ).
    os.utime(tmp_path / "main.py", ns=(first.mtime_ns + 10_000_000, first.mtime_ns + 10_000_000))
    [touched] = scan_files(str(tmp_path), ["main.py"], {"main.py": first})
    assert len(calls) == 1
    assert touched.content_hash == first.content_hash
    assert touched.mtime_ns != first.mtime_ns

    (tmp_path / "main.py").write_text("print('changed')\n")
    [changed] = scan_files(str(tmp_path), ["main.py"], {"main.py": touched})
    assert changed.content_hash != first.content_hash
