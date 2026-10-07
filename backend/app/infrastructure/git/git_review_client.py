"""Read-only Git review adapter. No fetches, staging, or repository writes."""
from __future__ import annotations

import difflib
import os
import subprocess
import tempfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

from git import GitError, Repo

from app.domain.exceptions import GitReviewError, NotAGitRepositoryError
from app.domain.git_models import GitChange, GitCommit, GitDiff, GitStatus
from app.domain.ports import GitReviewPort

MAX_DIFF_BYTES = 256_000


def remote_web_url(remote: str) -> str | None:
    """Only expose credential-free web links for recognized hosting services."""
    if remote.startswith("git@") and ":" in remote:
        host, path = remote[4:].split(":", 1)
    else:
        parsed = urlsplit(remote)
        if parsed.scheme not in {"https", "http", "ssh", "git"}:
            return None
        host, path = parsed.hostname, parsed.path.lstrip("/")
    if host not in {"github.com", "gitlab.com", "bitbucket.org"}:
        return None
    path = path.removesuffix(".git").rstrip("/")
    if not path or "?" in path or "#" in path:
        return None
    return f"https://{host}/{path}"


class GitReviewClient(GitReviewPort):
    def _repository(self, path: str) -> Repo:
        try:
            repo = Repo(path)
            if repo.bare or not repo.working_tree_dir:
                raise NotAGitRepositoryError("Select a Git working tree to review changes.")
            return repo
        except GitError as exc:
            raise NotAGitRepositoryError(
                "This folder is not a Git repository. Open a Git repository to review changes."
            ) from exc

    def _run(self, root: str, *arguments: str, limit: int = MAX_DIFF_BYTES) -> tuple[bytes, bool]:
        # Spool command output to disk so huge patches do not fill process memory.
        with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
            try:
                result = subprocess.run(
                    ["git", "--no-pager", "--literal-pathspecs", "-C", root, *arguments],
                    stdout=output,
                    stderr=errors,
                    env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
                    timeout=15,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired) as exc:
                raise GitReviewError("Git could not finish reading this repository. Try refreshing.") from exc
            if result.returncode:
                raise GitReviewError("Git could not read the requested changes. Try refreshing.")
            output.seek(0)
            raw = output.read(limit + 1)
            return raw[:limit], len(raw) > limit

    def _changes(self, root: str) -> list[GitChange]:
        raw, truncated = self._run(
            root, "status", "--porcelain=v1", "-z", "--untracked-files=all", limit=4_000_000
        )
        if truncated:
            raise GitReviewError("Too many changes to display. Reduce the working tree changes and refresh.")
        entries = iter(raw.split(b"\0"))
        changes = []
        for entry in entries:
            if not entry:
                continue
            index_status, worktree_status = chr(entry[0]), chr(entry[1])
            path = os.fsdecode(entry[3:])
            original_path = None
            if index_status in "RC" or worktree_status in "RC":
                original_path = os.fsdecode(next(entries))
            changes.append(GitChange(path, index_status, worktree_status, original_path))
        return changes

    def get_status(self, path: str) -> GitStatus:
        repo = self._repository(path)
        try:
            branch = None if repo.head.is_detached else repo.active_branch.name
            has_head = repo.head.is_valid()
            head_commit = repo.head.commit.hexsha if has_head else None
            tracking = None if branch is None else repo.active_branch.tracking_branch()
            upstream = tracking.name if tracking is not None else None
            ahead = behind = None
            if has_head and tracking is not None and tracking.is_valid():
                counts, _ = self._run(path, "rev-list", "--left-right", "--count", f"HEAD...{tracking.path}")
                ahead, behind = map(int, counts.split())
            remotes = list(repo.remotes)
            remote = next((item for item in remotes if item.name == "origin"), remotes[0] if remotes else None)
            remote_url = remote_web_url(remote.url) if remote is not None else None
            commits = [
                GitCommit(
                    commit.hexsha,
                    str(commit.message).splitlines()[0] if commit.message else "(No commit message)",
                    commit.author.name or "Unknown",
                    commit.committed_datetime,
                )
                for commit in repo.iter_commits(max_count=20)
            ] if has_head else []
            return GitStatus(
                branch, head_commit, upstream, ahead, behind,
                remote_url, self._changes(path), commits,
            )
        except (GitError, ValueError, IndexError) as exc:
            raise GitReviewError("Git metadata is no longer available. Try refreshing.") from exc

    def get_diff(self, root_path: str, path: str, staged: bool) -> GitDiff:
        self._repository(root_path)
        relative = PurePosixPath(path)
        if not path or relative.is_absolute() or ".." in relative.parts or ".git" in relative.parts:
            raise GitReviewError("Select a changed file inside the repository.")
        change = next((item for item in self._changes(root_path) if item.path == path), None)
        if change is None:
            raise GitReviewError("This file is no longer changed. Refresh the Git status.")
        if change.index_status == "?":
            if staged:
                raise GitReviewError("Untracked files do not have a staged diff.")
            return self._untracked_diff(root_path, path)
        paths = [path]
        if change.original_path is not None:
            paths.append(change.original_path)
        options = ["--cached"] if staged else []
        raw, truncated = self._run(
            root_path, "diff", "--no-ext-diff", "--no-textconv", "--no-color", *options, "--", *paths
        )
        content = raw.decode("utf-8", errors="replace")
        binary = any(line.startswith("Binary files ") for line in content.splitlines())
        return GitDiff(path, staged, content, is_binary=binary, truncated=truncated)

    def _untracked_diff(self, root_path: str, path: str) -> GitDiff:
        root = Path(root_path).resolve()
        target = root / path
        if target.is_symlink():
            # Show the symlink itself; never read its target outside the repository.
            raw = os.fsencode(os.readlink(target))
        else:
            resolved = target.resolve()
            if not resolved.is_relative_to(root) or not resolved.is_file():
                raise GitReviewError("This file is no longer available inside the repository.")
            try:
                with resolved.open("rb") as source:
                    raw = source.read(MAX_DIFF_BYTES + 1)
            except OSError as exc:
                raise GitReviewError("This untracked file could not be read. Try refreshing.") from exc
        truncated = len(raw) > MAX_DIFF_BYTES
        raw = raw[:MAX_DIFF_BYTES]
        if b"\0" in raw:
            return GitDiff(
                path, False, "Binary file — no text preview available.",
                is_binary=True, truncated=truncated,
            )
        lines = raw.decode("utf-8", errors="replace").splitlines(keepends=True)
        patch = "".join(difflib.unified_diff([], lines, fromfile="/dev/null", tofile=f"b/{path}"))
        encoded = patch.encode("utf-8")
        return GitDiff(
            path, False, encoded[:MAX_DIFF_BYTES].decode("utf-8", errors="replace"),
            truncated=truncated or len(encoded) > MAX_DIFF_BYTES,
        )
