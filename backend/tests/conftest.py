from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from git import Actor, Repo
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.infrastructure.db.database import Base, get_session
from app.infrastructure.db.sqlite_repository import SqlAlchemyFileMetadataRepository
from app.infrastructure.db.sqlite_symbol_repository import SqlAlchemySymbolRepository
from app.infrastructure.git.git_client import GitPythonClient
from app.infrastructure.parsing.file_scanner import scan_files
from app.infrastructure.parsing.treesitter_parser import TreeSitterCodeParser
from app.main import app
from app.services.indexing_service import IndexingService
from app.services.parsing_service import SymbolExtractionService

# Loading Tree-sitter grammars has fixed setup cost; shared once across the
# whole test session since the parser itself is stateless.
_code_parser = TreeSitterCodeParser()


@pytest.fixture
def git_repo_path(tmp_path: Path) -> Path:
    """A small, real Git repository used to exercise the full indexing flow."""
    repo_dir = tmp_path / "sample_repo"
    repo_dir.mkdir()
    repo = Repo.init(repo_dir)

    (repo_dir / "main.py").write_text("def main():\n    pass\n")
    (repo_dir / "README.md").write_text("# Sample\n")
    src_dir = repo_dir / "src"
    src_dir.mkdir()
    (src_dir / "app.ts").write_text("export const x = 1;\n")
    (repo_dir / ".gitignore").write_text("ignored.txt\n")
    (repo_dir / "ignored.txt").write_text("should never be indexed\n")

    repo.index.add(["main.py", "README.md", "src/app.ts", ".gitignore"])
    author = Actor("Test User", "test@example.com")
    repo.index.commit("initial commit", author=author, committer=author)

    # Untracked but NOT ignored -> should still be indexed.
    (repo_dir / "untracked.py").write_text("value = 1\n")

    return repo_dir


@pytest.fixture
def db_engine():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine) -> Iterator[Session]:
    session_factory = sessionmaker(bind=db_engine, expire_on_commit=False)
    session = session_factory()
    yield session
    session.close()


@pytest.fixture
def indexing_service(db_session: Session) -> IndexingService:
    symbol_extraction_service = SymbolExtractionService(
        parser=_code_parser,
        symbol_repository=SqlAlchemySymbolRepository(db_session),
    )
    return IndexingService(
        git_client=GitPythonClient(),
        file_repository=SqlAlchemyFileMetadataRepository(db_session),
        scan_files=scan_files,
        symbol_extraction_service=symbol_extraction_service,
    )


@pytest.fixture
def api_client(db_engine) -> Iterator[TestClient]:
    session_factory = sessionmaker(bind=db_engine, expire_on_commit=False)

    def override_get_session() -> Iterator[Session]:
        session = session_factory()
        try:
            yield session
            session.commit()
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    # Not entered as a context manager: lifespan (init_db) targets the real
    # on-disk database, which tests must never touch. The schema is already
    # created on `db_engine` above.
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
