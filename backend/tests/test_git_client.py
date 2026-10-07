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


def test_open_supports_non_git_directory(tmp_path: Path) -> None:
    folder = tmp_path / "plain_folder"
    folder.mkdir()
    (folder / "sample.py").write_text("print(1)\n")
    client = GitPythonClient()

    info = client.open(str(folder))
    assert info.name == "plain_folder"
    assert info.root_path == str(folder)
    assert info.current_branch is None

    files = client.list_tracked_files(str(folder))
    assert files == ["sample.py"]


def test_open_rejects_nonexistent_path(tmp_path: Path) -> None:
    client = GitPythonClient()

    with pytest.raises(NotAGitRepositoryError):
        client.open(str(tmp_path / "does_not_exist"))


def test_open_supports_multi_repo_directory(tmp_path: Path) -> None:
    from git import Actor, Repo

    workspace = tmp_path / "workspace"
    workspace.mkdir()

    repo1 = workspace / "backend"
    repo1.mkdir()
    r1 = Repo.init(repo1)
    (repo1 / "server.py").write_text("pass\n")
    r1.index.add(["server.py"])
    author = Actor("User", "user@test.com")
    r1.index.commit("init backend", author=author, committer=author)

    repo2 = workspace / "frontend"
    repo2.mkdir()
    r2 = Repo.init(repo2)
    (repo2 / "app.js").write_text("pass\n")
    r2.index.add(["app.js"])
    r2.index.commit("init frontend", author=author, committer=author)

    client = GitPythonClient()
    info = client.open(str(workspace))
    assert info.name == "workspace"
    assert "backend" in (info.current_branch or "")
    assert "frontend" in (info.current_branch or "")

    files = client.list_tracked_files(str(workspace))
    assert set(files) == {"backend/server.py", "frontend/app.js"}


def test_list_tracked_files_includes_tracked_and_untracked_excludes_ignored(
    git_repo_path: Path,
) -> None:
    client = GitPythonClient()

    files = client.list_tracked_files(str(git_repo_path))

    assert set(files) == {"main.py", "README.md", "src/app.ts", ".gitignore", "untracked.py"}
    assert "ignored.txt" not in files
