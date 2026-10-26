from pathlib import Path

import pytest

from app.domain.exceptions import (
    IndexedFileNotFoundError,
    NotAGitRepositoryError,
    RepositoryNotFoundError,
)
from app.domain.models import SymbolKind
from app.services.indexing_service import IndexingService


def test_open_repository_indexes_tracked_and_untracked_files(
    indexing_service: IndexingService, git_repo_path: Path
) -> None:
    info = indexing_service.open_repository(str(git_repo_path))

    assert info.id is not None
    assert info.name == git_repo_path.name
    assert info.file_count == 5  # main.py, README.md, src/app.ts, .gitignore, untracked.py


def test_open_repository_twice_reindexes_without_duplicating(
    indexing_service: IndexingService, git_repo_path: Path
) -> None:
    first = indexing_service.open_repository(str(git_repo_path))
    (git_repo_path / "extra.py").write_text("x = 1\n")

    second = indexing_service.open_repository(str(git_repo_path))

    assert second.id == first.id
    assert second.file_count == 6


def test_open_repository_supports_non_git_path(
    indexing_service: IndexingService, tmp_path: Path
) -> None:
    folder = tmp_path / "plain_folder"
    folder.mkdir()
    (folder / "file.py").write_text("def hello():\n    pass\n")

    info = indexing_service.open_repository(str(folder))
    assert info.name == "plain_folder"
    assert info.file_count == 1


def test_open_repository_rejects_nonexistent_path(
    indexing_service: IndexingService, tmp_path: Path
) -> None:
    with pytest.raises(NotAGitRepositoryError):
        indexing_service.open_repository(str(tmp_path / "does_not_exist"))


def test_get_tree_reflects_indexed_files(
    indexing_service: IndexingService, git_repo_path: Path
) -> None:
    info = indexing_service.open_repository(str(git_repo_path))

    tree = indexing_service.get_tree(info.id)

    file_names = {child.name for child in tree.children}
    assert "main.py" in file_names
    assert "src" in file_names


def test_get_repository_raises_for_unknown_id(indexing_service: IndexingService) -> None:
    with pytest.raises(RepositoryNotFoundError):
        indexing_service.get_repository(999)


def test_list_repositories_returns_all_opened(
    indexing_service: IndexingService, git_repo_path: Path, tmp_path: Path
) -> None:
    from git import Repo

    other_repo = tmp_path / "other"
    other_repo.mkdir()
    Repo.init(other_repo)

    indexing_service.open_repository(str(git_repo_path))
    indexing_service.open_repository(str(other_repo))

    repos = indexing_service.list_repositories()

    assert {r.root_path for r in repos} == {str(git_repo_path), str(other_repo)}


def test_open_repository_extracts_symbols_for_supported_files(
    indexing_service: IndexingService, git_repo_path: Path
) -> None:
    info = indexing_service.open_repository(str(git_repo_path))

    tree = indexing_service.get_tree(info.id)
    main_py = next(_find_file(tree, "main.py"))

    symbols = indexing_service.get_symbols(main_py.file_id)

    assert [s.name for s in symbols] == ["main"]
    assert symbols[0].kind == SymbolKind.FUNCTION


def test_get_symbols_raises_for_unknown_file(indexing_service: IndexingService) -> None:
    with pytest.raises(IndexedFileNotFoundError):
        indexing_service.get_symbols(999)


def _find_file(node, name: str):
    if not node.is_directory and node.name == name:
        yield node
    for child in node.children:
        yield from _find_file(child, name)


class _CountingParser:
    """Delegates to the real parser while counting parse calls."""

    def __init__(self, inner) -> None:
        self._inner = inner
        self.calls: list[str] = []

    def supports(self, language) -> bool:
        return self._inner.supports(language)

    def parse(self, source: bytes, language):
        self.calls.append(language.value)
        return self._inner.parse(source, language)


def _counting_service(db_session):
    from tests.conftest import _code_parser
    from app.infrastructure.db.sqlite_repository import SqlAlchemyFileMetadataRepository
    from app.infrastructure.db.sqlite_symbol_repository import SqlAlchemySymbolRepository
    from app.infrastructure.git.git_client import GitPythonClient
    from app.infrastructure.parsing.file_scanner import scan_files
    from app.services.parsing_service import SymbolExtractionService

    parser = _CountingParser(_code_parser)
    service = IndexingService(
        git_client=GitPythonClient(),
        file_repository=SqlAlchemyFileMetadataRepository(db_session),
        scan_files=scan_files,
        symbol_extraction_service=SymbolExtractionService(
            parser=parser, symbol_repository=SqlAlchemySymbolRepository(db_session)
        ),
    )
    return service, parser


def test_reopen_keeps_file_ids_and_skips_unchanged_files(db_session, git_repo_path: Path) -> None:
    service, parser = _counting_service(db_session)
    first = service.open_repository(str(git_repo_path))
    first_ids = {f.path: f.file_id for f in _leaves(service.get_tree(first.id))}
    parsed_initially = len(parser.calls)
    assert parsed_initially > 0

    second = service.open_repository(str(git_repo_path))

    assert second.file_count == first.file_count
    assert {f.path: f.file_id for f in _leaves(service.get_tree(second.id))} == first_ids
    assert len(parser.calls) == parsed_initially  # nothing changed, nothing re-parsed


def test_reopen_reparses_changed_files_and_drops_deleted_ones(db_session, git_repo_path: Path) -> None:
    service, parser = _counting_service(db_session)
    info = service.open_repository(str(git_repo_path))
    main_py = next(_find_file(service.get_tree(info.id), "main.py"))
    readme = next(_find_file(service.get_tree(info.id), "README.md"))
    parser.calls.clear()

    (git_repo_path / "main.py").write_text("def main():\n    pass\n\ndef helper():\n    pass\n")
    (git_repo_path / "README.md").unlink()

    refreshed = service.open_repository(str(git_repo_path))

    assert refreshed.file_count == info.file_count - 1
    assert parser.calls == ["python"]  # only the edited file was parsed again
    assert [s.name for s in service.get_symbols(main_py.file_id)] == ["main", "helper"]
    with pytest.raises(IndexedFileNotFoundError):
        service.get_symbols(readme.file_id)


def test_reindex_repository_reparses_every_file(db_session, git_repo_path: Path) -> None:
    service, parser = _counting_service(db_session)
    info = service.open_repository(str(git_repo_path))
    parsed_initially = len(parser.calls)
    parser.calls.clear()

    reindexed = service.reindex_repository(info.id)

    assert reindexed.id == info.id
    assert len(parser.calls) == parsed_initially


def _leaves(node):
    if not node.is_directory:
        yield node
    for child in node.children:
        yield from _leaves(child)


def test_reopen_does_not_rehash_unchanged_files(db_session, git_repo_path: Path, monkeypatch) -> None:
    from app.infrastructure.parsing import file_scanner

    service, _ = _counting_service(db_session)
    service.open_repository(str(git_repo_path))
    reads: list[Path] = []
    original = file_scanner._hash_and_sniff
    monkeypatch.setattr(file_scanner, "_hash_and_sniff", lambda path: reads.append(path) or original(path))

    (git_repo_path / "main.py").write_text("def main():\n    return 1\n")
    refreshed = service.open_repository(str(git_repo_path))

    assert refreshed.file_count == 5
    assert [path.name for path in reads] == ["main.py"]  # only the edited file was read


def test_saving_records_the_new_mtime_so_the_next_open_skips_the_file(db_session, git_repo_path: Path, monkeypatch) -> None:
    from app.infrastructure.parsing import file_scanner

    service, _ = _counting_service(db_session)
    info = service.open_repository(str(git_repo_path))
    main_py = next(_find_file(service.get_tree(info.id), "main.py"))
    preview = service.get_file_preview(main_py.file_id)
    service.save_file_content(main_py.file_id, "def main():\n    return 'saved'\n", preview.content_hash)

    reads: list[Path] = []
    original = file_scanner._hash_and_sniff
    monkeypatch.setattr(file_scanner, "_hash_and_sniff", lambda path: reads.append(path) or original(path))
    service.open_repository(str(git_repo_path))
    assert reads == []
