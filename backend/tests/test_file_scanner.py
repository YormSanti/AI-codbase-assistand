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
