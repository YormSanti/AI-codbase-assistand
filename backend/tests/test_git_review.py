from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from git import Actor, Repo

from app.domain.exceptions import GitReviewError
from app.infrastructure.git.git_review_client import GitReviewClient, MAX_DIFF_BYTES, remote_web_url


def open_project(client: TestClient, path: Path) -> str:
    response = client.post("/api/repositories/open", json={"path": str(path)})
    assert response.status_code == 200
    return f"/api/repositories/{response.json()['id']}/git"


def test_live_status_history_and_remote_without_reindex(api_client: TestClient, git_repo_path: Path) -> None:
    base = open_project(api_client, git_repo_path)
    repo = Repo(git_repo_path)
    repo.create_remote("origin", "git@github.com:example/sample.git")
    (git_repo_path / "main.py").write_text("def main():\n    return 42\n")
    (git_repo_path / "new file.txt").write_text("new content\n")
    status = api_client.get(base).json()
    changes = {change["path"]: change for change in status["changes"]}
    assert changes["main.py"]["worktree_status"] == "M"
    assert changes["new file.txt"]["index_status"] == "?"
    assert "ignored.txt" not in changes
    assert status["branch"] == repo.active_branch.name
    assert status["head_commit"] == repo.head.commit.hexsha
    assert status["commits"][0]["message"] == "initial commit"
    assert status["commits"][0]["author"] == "Test User"
    assert status["remote_url"] == "https://github.com/example/sample"
    assert status["ahead"] is None


def test_subfolder_workspace_reviews_containing_git_repository(api_client: TestClient, git_repo_path: Path) -> None:
    frontend = git_repo_path / "frontend"
    frontend.mkdir()
    (frontend / "app.ts").write_text("export const original = true;\n")
    repo = Repo(git_repo_path)
    repo.index.add(["frontend/app.ts"])
    base = open_project(api_client, frontend)
    (frontend / "app.ts").write_text("export const updated = true;\n")
    (frontend / "new.ts").write_text("frontend draft\n")
    (git_repo_path / "main.py").write_text("print('parent change')\n")

    response = api_client.get(base)
    assert response.status_code == 200
    status = response.json()
    assert status['branch'] == repo.active_branch.name
    assert {'frontend/app.ts', 'frontend/new.ts', 'main.py'} <= {change['path'] for change in status['changes']}
    staged = api_client.get(base + '/diff', params={'path': 'frontend/app.ts', 'staged': True})
    assert staged.status_code == 200
    assert '+export const original = true;' in staged.json()['content']
    worktree = api_client.get(base + '/diff', params={'path': 'frontend/app.ts'})
    assert worktree.status_code == 200
    assert '+export const updated = true;' in worktree.json()['content']
    untracked = api_client.get(base + '/diff', params={'path': 'frontend/new.ts'})
    assert untracked.status_code == 200
    assert '+frontend draft' in untracked.json()['content']


def test_staged_and_worktree_diffs_are_separate_and_read_only(api_client: TestClient, git_repo_path: Path) -> None:
    base = open_project(api_client, git_repo_path)
    repo = Repo(git_repo_path)
    target = git_repo_path / "main.py"
    target.write_text("def main():\n    return 'staged'\n")
    repo.index.add(["main.py"])
    target.write_text("def main():\n    return 'worktree'\n")
    before = repo.git.status("--porcelain")
    index_before = (git_repo_path / ".git/index").read_bytes()
    staged = api_client.get(f"{base}/diff", params={"path": "main.py", "staged": True})
    worktree = api_client.get(f"{base}/diff", params={"path": "main.py"})
    assert staged.status_code == worktree.status_code == 200
    assert "+    return 'staged'" in staged.json()["content"]
    assert "worktree" not in staged.json()["content"]
    assert "-    return 'staged'" in worktree.json()["content"]
    assert "+    return 'worktree'" in worktree.json()["content"]
    assert repo.git.status("--porcelain") == before
    assert (git_repo_path / ".git/index").read_bytes() == index_before
    assert target.read_text() == "def main():\n    return 'worktree'\n"


def test_renames_and_literal_filenames(git_repo_path: Path) -> None:
    repo = Repo(git_repo_path)
    repo.git.mv("README.md", "renamed [notes].md")
    client = GitReviewClient()
    change = next(item for item in client.get_status(str(git_repo_path)).changes if item.path == "renamed [notes].md")
    assert change.index_status == "R"
    assert change.original_path == "README.md"
    patch = client.get_diff(str(git_repo_path), change.path, True).content
    assert "rename from README.md" in patch
    assert "rename to renamed [notes].md" in patch
    (git_repo_path / "literal*.txt").write_text("only this file\n")
    (git_repo_path / "literal-other.txt").write_text("do not include this file\n")
    patch = client.get_diff(str(git_repo_path), "literal*.txt", False).content
    assert "+only this file" in patch
    assert "do not include" not in patch


def test_untracked_binary_symlink_and_large_preview(git_repo_path: Path, tmp_path: Path) -> None:
    client = GitReviewClient()
    (git_repo_path / "binary.dat").write_bytes(b"abc\0xyz")
    binary = client.get_diff(str(git_repo_path), "binary.dat", False)
    assert binary.is_binary
    (git_repo_path / "large.txt").write_text("long line\n" * MAX_DIFF_BYTES)
    large = client.get_diff(str(git_repo_path), "large.txt", False)
    assert large.truncated
    assert len(large.content.encode()) <= MAX_DIFF_BYTES
    outside = tmp_path / "private.txt"
    outside.write_text("secret outside project")
    (git_repo_path / "link.txt").symlink_to(outside)
    patch = client.get_diff(str(git_repo_path), "link.txt", False).content
    assert str(outside) in patch
    assert "secret outside project" not in patch


def test_unborn_and_detached_repositories(tmp_path: Path, git_repo_path: Path) -> None:
    empty = tmp_path / "empty"
    repo = Repo.init(empty)
    (empty / "first.txt").write_text("first\n")
    repo.index.add(["first.txt"])
    client = GitReviewClient()
    status = client.get_status(str(empty))
    assert status.head_commit is None
    assert status.commits == []
    assert "+first" in client.get_diff(str(empty), "first.txt", True).content
    Repo(git_repo_path).git.checkout("--detach")
    assert client.get_status(str(git_repo_path)).branch is None


def test_ahead_behind_uses_local_upstream(git_repo_path: Path) -> None:
    repo = Repo(git_repo_path)
    repo.create_remote("origin", "https://github.com/example/repo.git")
    repo.git.update_ref("refs/remotes/origin/main", repo.head.commit.hexsha)
    branch = repo.active_branch.name
    repo.git.config(f"branch.{branch}.remote", "origin")
    repo.git.config(f"branch.{branch}.merge", "refs/heads/main")
    (git_repo_path / "main.py").write_text("print('new')\n")
    repo.index.add(["main.py"])
    actor = Actor("Test", "test@example.com")
    repo.index.commit("second", author=actor, committer=actor)
    status = GitReviewClient().get_status(str(git_repo_path))
    assert status.upstream == "origin/main"
    assert (status.ahead, status.behind) == (1, 0)


def test_merge_conflicts_are_visible(git_repo_path: Path) -> None:
    repo = Repo(git_repo_path)
    original = repo.active_branch.name
    repo.git.checkout("-b", "other")
    actor = Actor("Test", "test@example.com")
    (git_repo_path / "main.py").write_text("other\n")
    repo.index.add(["main.py"])
    repo.index.commit("other", author=actor, committer=actor)
    repo.git.checkout(original)
    (git_repo_path / "main.py").write_text("current\n")
    repo.index.add(["main.py"])
    repo.index.commit("current", author=actor, committer=actor)
    repo.git.config("user.name", "Test")
    repo.git.config("user.email", "test@example.com")
    repo.git.merge("other", with_exceptions=False)
    client = GitReviewClient()
    change = next(item for item in client.get_status(str(git_repo_path)).changes if item.path == "main.py")
    assert change.index_status + change.worktree_status == "UU"
    assert "<<<<<<<" in client.get_diff(str(git_repo_path), "main.py", False).content


def test_invalid_project_and_diff_requests(api_client: TestClient, git_repo_path: Path, tmp_path: Path) -> None:
    assert api_client.get("/api/repositories/999/git").status_code == 404
    assert api_client.get("/api/repositories/999/git/diff", params={"path": "main.py"}).status_code == 404
    folder = tmp_path / "plain"
    folder.mkdir()
    plain_base = open_project(api_client, folder)
    assert api_client.get(plain_base).status_code == 400
    base = open_project(api_client, git_repo_path)
    for path in ["../private.txt", "/etc/passwd", ".git/config", "README.md"]:
        assert api_client.get(f"{base}/diff", params={"path": path}).status_code == 409
    assert api_client.get(f"{base}/diff", params={"path": "untracked.py", "staged": True}).status_code == 409
    with pytest.raises(GitReviewError):
        GitReviewClient().get_diff(str(git_repo_path), "../private.txt", False)


@pytest.mark.parametrize(("remote", "expected"), [
    ("git@github.com:owner/repo.git", "https://github.com/owner/repo"),
    ("https://user:secret@gitlab.com/group/repo.git", "https://gitlab.com/group/repo"),
    ("ssh://git@bitbucket.org/owner/repo.git", "https://bitbucket.org/owner/repo"),
    ("https://example.com/repo.git", None),
    ("/local/repo", None),
    ("javascript:alert(1)", None),
])
def test_remote_web_links(remote: str, expected: str | None) -> None:
    assert remote_web_url(remote) == expected
