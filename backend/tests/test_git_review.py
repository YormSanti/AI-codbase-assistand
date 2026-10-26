from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from git import Actor, Repo

from app.domain.exceptions import GitCommandError, GitReviewError
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


def _configure_identity(path: Path) -> Repo:
    repo = Repo(path)
    repo.git.config("user.name", "Test User")
    repo.git.config("user.email", "test@example.com")
    return repo


def test_stage_unstage_and_commit_from_the_api(api_client: TestClient, git_repo_path: Path) -> None:
    base = open_project(api_client, git_repo_path)
    repo = _configure_identity(git_repo_path)
    (git_repo_path / "main.py").write_text("def main():\n    return 'edited'\n")
    (git_repo_path / "notes.txt").write_text("brand new\n")
    (git_repo_path / "README.md").unlink()

    staged = api_client.post(f"{base}/stage", json={"paths": ["main.py", "notes.txt", "README.md"]})
    assert staged.status_code == 200
    index = {change["path"]: change["index_status"] for change in staged.json()["changes"]}
    assert {path: index[path] for path in ["main.py", "notes.txt", "README.md"]} == {"main.py": "M", "notes.txt": "A", "README.md": "D"}
    assert index["untracked.py"] == "?"

    unstaged = api_client.post(f"{base}/unstage", json={"paths": ["notes.txt"]})
    assert unstaged.status_code == 200
    index = {change["path"]: change["index_status"] for change in unstaged.json()["changes"]}
    assert index["notes.txt"] == "?"
    assert index["main.py"] == "M"
    assert (git_repo_path / "notes.txt").read_text() == "brand new\n"  # working tree untouched

    committed = api_client.post(f"{base}/commit", json={"message": "feat: edit main and drop readme"})
    assert committed.status_code == 200
    body = committed.json()
    assert body["commits"][0]["message"] == "feat: edit main and drop readme"
    assert body["head_commit"] == repo.head.commit.hexsha
    assert {change["path"] for change in body["changes"]} == {"notes.txt", "untracked.py"}
    assert repo.head.commit.stats.files.keys() >= {"main.py", "README.md"}


def test_commit_and_stage_are_validated(api_client: TestClient, git_repo_path: Path) -> None:
    base = open_project(api_client, git_repo_path)
    _configure_identity(git_repo_path)
    nothing_staged = api_client.post(f"{base}/commit", json={"message": "nothing here"})
    assert nothing_staged.status_code == 409
    assert "Nothing is staged" in nothing_staged.json()["detail"]
    assert api_client.post(f"{base}/commit", json={"message": "   "}).status_code == 409
    assert api_client.post(f"{base}/commit", json={"message": ""}).status_code == 422
    for path in ["../private.txt", "/etc/passwd", ".git/config", "README.md"]:
        response = api_client.post(f"{base}/stage", json={"paths": [path]})
        assert response.status_code == 409, path
    assert api_client.post(f"{base}/unstage", json={"paths": ["untracked.py"]}).status_code == 409
    assert api_client.post(f"{base}/stage", json={"paths": []}).status_code == 422
    assert api_client.post("/api/repositories/999/git/stage", json={"paths": ["main.py"]}).status_code == 404


def test_commit_surfaces_git_errors_and_blocks_conflicts(git_repo_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # Isolate from the developer's global identity so the missing-identity path is exercised.
    empty_config = tmp_path / "empty-gitconfig"
    empty_config.write_text("")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(empty_config))
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    repo = Repo(git_repo_path)
    client = GitReviewClient()
    (git_repo_path / "main.py").write_text("changed\n")
    client.stage(str(git_repo_path), ["main.py"])
    repo.git.config("user.useConfigOnly", "true")
    with pytest.raises(GitCommandError) as missing_identity:
        client.commit(str(git_repo_path), "no identity")
    assert "identity" in str(missing_identity.value).lower() or "email" in str(missing_identity.value).lower()
    repo.git.config("--unset", "user.useConfigOnly")
    _configure_identity(git_repo_path)

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
    repo.git.merge("other", with_exceptions=False)
    with pytest.raises(GitCommandError) as conflict:
        client.commit(str(git_repo_path), "merge attempt")
    assert "conflict" in str(conflict.value).lower()


def test_unborn_repository_can_stage_unstage_and_commit(tmp_path: Path) -> None:
    empty = tmp_path / "fresh"
    Repo.init(empty)
    _configure_identity(empty)
    (empty / "first.txt").write_text("first\n")
    client = GitReviewClient()
    client.stage(str(empty), ["first.txt"])
    assert client.get_status(str(empty)).changes[0].index_status == "A"
    client.unstage(str(empty), ["first.txt"])
    assert client.get_status(str(empty)).changes[0].index_status == "?"
    client.stage(str(empty), ["first.txt"])
    commit = client.commit(str(empty), "Initial commit")
    assert commit.message == "Initial commit"
    status = client.get_status(str(empty))
    assert status.head_commit == commit.sha
    assert status.changes == []


def test_staged_diff_combines_only_staged_files(api_client: TestClient, git_repo_path: Path) -> None:
    base = open_project(api_client, git_repo_path)
    empty = api_client.get(f"{base}/staged-diff")
    assert empty.status_code == 200
    assert empty.json() == {"content": "", "stat": "", "files": 0, "truncated": False}

    repo = Repo(git_repo_path)
    (git_repo_path / "main.py").write_text("def main():\n    return 'staged'\n")
    (git_repo_path / "notes.txt").write_text("new staged file\n")
    repo.index.add(["main.py", "notes.txt"])
    (git_repo_path / "README.md").write_text("# unstaged edit\n")

    body = api_client.get(f"{base}/staged-diff").json()
    assert body["files"] == 2
    assert body["truncated"] is False
    assert "+    return 'staged'" in body["content"]
    assert "+new staged file" in body["content"]
    assert "unstaged edit" not in body["content"]
    assert "main.py" in body["stat"] and "notes.txt" in body["stat"]
    assert "2 files changed" in body["stat"]


def test_staged_diff_on_an_unborn_branch(tmp_path: Path) -> None:
    empty = tmp_path / "unborn"
    repo = Repo.init(empty)
    (empty / "first.txt").write_text("first\n")
    repo.index.add(["first.txt"])
    staged = GitReviewClient().get_staged_diff(str(empty))
    assert staged.files == 1
    assert "+first" in staged.content


def _commit_all(repo: Repo, message: str) -> str:
    actor = Actor("Test User", "test@example.com")
    repo.git.add("-A")
    return repo.index.commit(message, author=actor, committer=actor).hexsha


def test_commit_details_list_files_with_status_and_counts(api_client: TestClient, git_repo_path: Path) -> None:
    base = open_project(api_client, git_repo_path)
    repo = Repo(git_repo_path)
    (git_repo_path / "main.py").write_text("def main():\n    return 42\n\n\ndef extra():\n    pass\n")
    (git_repo_path / "src" / "new file.ts").write_text("export const created = true;\n")
    repo.git.mv("README.md", "GUIDE.md")
    repo.index.remove([".gitignore"], working_tree=True)
    (git_repo_path / "logo.bin").write_bytes(b"\x00\x01binary")
    sha = _commit_all(repo, "feat: second commit\n\nLonger body text.")

    response = api_client.get(f"{base}/commits/{sha[:10]}")
    assert response.status_code == 200
    body = response.json()
    assert body["sha"] == sha
    assert body["message"] == "feat: second commit\n\nLonger body text."
    assert body["author"] == "Test User" and body["author_email"] == "test@example.com"
    assert len(body["parents"]) == 1
    files = {file["path"]: file for file in body["files"]}
    assert files["main.py"]["status"] == "M"
    assert (files["main.py"]["additions"], files["main.py"]["deletions"]) == (4, 0)
    assert files["src/new file.ts"]["status"] == "A"
    assert files["GUIDE.md"]["status"] == "R" and files["GUIDE.md"]["original_path"] == "README.md"
    assert files[".gitignore"]["status"] == "D"
    assert files["logo.bin"]["additions"] is None  # binary

    diff = api_client.get(f"{base}/commits/{sha}/diff", params={"path": "main.py"}).json()
    assert "+def extra():" in diff["content"] and "+    return 42" in diff["content"]
    renamed = api_client.get(f"{base}/commits/{sha}/diff", params={"path": "GUIDE.md"}).json()
    assert "rename from README.md" in renamed["content"]
    binary = api_client.get(f"{base}/commits/{sha}/diff", params={"path": "logo.bin"}).json()
    assert binary["is_binary"] is True


def test_root_and_merge_commits_compare_with_nothing_and_the_first_parent(git_repo_path: Path) -> None:
    repo = Repo(git_repo_path)
    client = GitReviewClient()
    root_sha = repo.head.commit.hexsha
    root = client.get_commit(str(git_repo_path), root_sha)
    assert root.parents == []
    assert {file.path for file in root.files} == {"main.py", "README.md", "src/app.ts", ".gitignore"}
    assert all(file.status == "A" for file in root.files)
    assert "+def main():" in client.get_commit_diff(str(git_repo_path), root_sha, "main.py").content

    original = repo.active_branch.name
    repo.git.checkout("-b", "feature")
    (git_repo_path / "feature.txt").write_text("feature work\n")
    _commit_all(repo, "feature work")
    repo.git.checkout(original)
    (git_repo_path / "main.txt").write_text("mainline work\n")
    _commit_all(repo, "mainline work")
    repo.git.config("user.name", "Test User")
    repo.git.config("user.email", "test@example.com")
    repo.git.merge("feature", "--no-ff", "-m", "merge feature")
    merge = client.get_commit(str(git_repo_path), repo.head.commit.hexsha)
    assert len(merge.parents) == 2
    # Relative to the first parent the merge brings in the feature branch's files
    # (the fixture's untracked.py was committed there by `git add -A`), not mainline work.
    assert {file.path for file in merge.files} == {"feature.txt", "untracked.py"}


def test_commit_requests_are_validated(api_client: TestClient, git_repo_path: Path) -> None:
    base = open_project(api_client, git_repo_path)
    sha = Repo(git_repo_path).head.commit.hexsha
    for bad in ["HEAD", "main", "not-a-sha", "0123456789abcdef0123456789abcdef01234567"]:
        assert api_client.get(f"{base}/commits/{bad}").status_code == 409, bad
    missing_file = api_client.get(f"{base}/commits/{sha}/diff", params={"path": "untracked.py"})
    assert missing_file.status_code == 409
    assert "not changed in that commit" in missing_file.json()["detail"]
    assert api_client.get(f"/api/repositories/999/git/commits/{sha}").status_code == 404
