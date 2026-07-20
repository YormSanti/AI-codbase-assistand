from pathlib import Path

import pytest

from app.domain.exceptions import NotAGitRepositoryError, RepositoryNotFoundError
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


def test_open_repository_rejects_non_git_path(
    indexing_service: IndexingService, tmp_path: Path
) -> None:
    with pytest.raises(NotAGitRepositoryError):
        indexing_service.open_repository(str(tmp_path))


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
