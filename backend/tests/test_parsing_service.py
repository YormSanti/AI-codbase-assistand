from pathlib import Path

from sqlalchemy.orm import Session

from app.domain.models import FileMetadata, Language, RepositoryInfo, SymbolKind
from app.infrastructure.db.sqlite_repository import SqlAlchemyFileMetadataRepository
from app.infrastructure.db.sqlite_symbol_repository import SqlAlchemySymbolRepository
from app.infrastructure.parsing.treesitter_parser import TreeSitterCodeParser
from app.services.parsing_service import SymbolExtractionService


def _service(db_session: Session) -> SymbolExtractionService:
    return SymbolExtractionService(
        parser=TreeSitterCodeParser(),
        symbol_repository=SqlAlchemySymbolRepository(db_session),
    )


def _persisted_file(db_session: Session, relative_path: str, language: Language) -> FileMetadata:
    """Symbols FK-reference `files.id`, so tests need a real file row, not a bare int."""
    file_repository = SqlAlchemyFileMetadataRepository(db_session)
    repo = file_repository.save_repository(
        RepositoryInfo(name="repo", root_path=f"/repo-{relative_path}", current_branch=None, head_commit=None)
    )
    [file] = file_repository.replace_files(
        repo.id,
        [
            FileMetadata(
                relative_path=relative_path,
                size_bytes=1,
                language=language,
                content_hash="deadbeef",
                is_binary=False,
            )
        ],
    )
    return file


def test_extract_and_store_parses_and_persists_symbols(
    db_session: Session, tmp_path: Path
) -> None:
    (tmp_path / "main.py").write_text("class Foo:\n    def bar(self):\n        pass\n")
    file = _persisted_file(db_session, "main.py", Language.PYTHON)

    result = _service(db_session).extract_and_store(file, str(tmp_path))

    assert {s.name for s in result} == {"Foo", "bar"}
    assert all(s.id is not None for s in result)


def test_extract_and_store_skips_binary_files(db_session: Session, tmp_path: Path) -> None:
    (tmp_path / "image.png").write_bytes(b"\x00\x01")
    file_repository = SqlAlchemyFileMetadataRepository(db_session)
    repo = file_repository.save_repository(
        RepositoryInfo(name="repo", root_path="/repo-binary", current_branch=None, head_commit=None)
    )
    [file] = file_repository.replace_files(
        repo.id,
        [
            FileMetadata(
                relative_path="image.png",
                size_bytes=2,
                language=Language.OTHER,
                content_hash="deadbeef",
                is_binary=True,
            )
        ],
    )

    result = _service(db_session).extract_and_store(file, str(tmp_path))

    assert result == []


def test_extract_and_store_skips_unsupported_language(db_session: Session, tmp_path: Path) -> None:
    (tmp_path / "main.rs").write_text("fn main() {}\n")
    file = _persisted_file(db_session, "main.rs", Language.RUST)

    result = _service(db_session).extract_and_store(file, str(tmp_path))

    assert result == []


def test_extract_and_store_replaces_symbols_on_reparse(db_session: Session, tmp_path: Path) -> None:
    (tmp_path / "main.py").write_text("def old():\n    pass\n")
    file = _persisted_file(db_session, "main.py", Language.PYTHON)
    service = _service(db_session)
    service.extract_and_store(file, str(tmp_path))

    (tmp_path / "main.py").write_text("def new():\n    pass\n")
    result = service.extract_and_store(file, str(tmp_path))

    assert [s.name for s in result] == ["new"]
    assert [s.name for s in service.list_for_file(file.id)] == ["new"]


def test_list_for_file_returns_persisted_symbols(db_session: Session, tmp_path: Path) -> None:
    (tmp_path / "main.py").write_text("def f():\n    pass\n")
    file = _persisted_file(db_session, "main.py", Language.PYTHON)
    service = _service(db_session)
    service.extract_and_store(file, str(tmp_path))

    [symbol] = service.list_for_file(file.id)

    assert symbol.name == "f"
    assert symbol.kind == SymbolKind.FUNCTION
