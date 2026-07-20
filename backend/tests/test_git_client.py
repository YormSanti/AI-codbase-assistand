from pathlib import Path

import pytest

from app.domain.exceptions import NotAGitRepositoryError
from app.infrastructure.git.git_client import GitPythonClient


def test_open_returns_repository_metadata(git_repo_path: Path) -> None:
    client = GitPythonClient()

    info = client.open(str(git_repo_path))

    assert info.name == git_repo_path.name
    assert info.root_path == str(git_repo_path)
    assert info.current_branch is not None
    assert info.head_commit is not None
    assert len(info.head_commit) == 40


def test_open_rejects_non_git_directory(tmp_path: Path) -> None:
    client = GitPythonClient()

    with pytest.raises(NotAGitRepositoryError):
        client.open(str(tmp_path))


def test_list_tracked_files_includes_tracked_and_untracked_excludes_ignored(
    git_repo_path: Path,
) -> None:
    client = GitPythonClient()

    files = client.list_tracked_files(str(git_repo_path))

    assert set(files) == {"main.py", "README.md", "src/app.ts", ".gitignore", "untracked.py"}
    assert "ignored.txt" not in files
