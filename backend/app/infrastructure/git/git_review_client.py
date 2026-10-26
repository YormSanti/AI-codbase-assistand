"""Git review adapter: read-only status and diffs, plus explicit stage, unstage, and commit."""
from __future__ import annotations

import difflib
import os
import subprocess
import tempfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

from git import GitError, Repo

from app.domain.exceptions import GitCommandError, GitReviewError, NotAGitRepositoryError
from app.domain.git_models import GitChange, GitCommit, GitDiff, GitStatus, StagedDiff
from app.domain.ports import GitReviewPort

MAX_DIFF_BYTES = 256_000
MAX_COMMIT_MESSAGE_CHARS = 10_000


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
            repo = Repo(path, search_parent_directories=True)
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
        root = str(repo.working_tree_dir)
        try:
            branch = None if repo.head.is_detached else repo.active_branch.name
            has_head = repo.head.is_valid()
            head_commit = repo.head.commit.hexsha if has_head else None
            tracking = None if branch is None else repo.active_branch.tracking_branch()
            upstream = tracking.name if tracking is not None else None
            ahead = behind = None
            if has_head and tracking is not None and tracking.is_valid():
                counts, _ = self._run(root, "rev-list", "--left-right", "--count", f"HEAD...{tracking.path}")
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
                remote_url, self._changes(root), commits,
            )
        except (GitError, ValueError, IndexError) as exc:
            raise GitReviewError("Git metadata is no longer available. Try refreshing.") from exc

    def get_diff(self, root_path: str, path: str, staged: bool) -> GitDiff:
        repo = self._repository(root_path)
        root_path = str(repo.working_tree_dir)
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

    def get_staged_diff(self, root_path: str) -> StagedDiff:
        repo = self._repository(root_path)
        root = str(repo.working_tree_dir)
        options = ("--cached", "-M", "--no-ext-diff", "--no-textconv", "--no-color")
        names, _ = self._run(root, "diff", *options, "--name-only", "-z", limit=4_000_000)
        files = len([name for name in names.split(b"\0") if name])
        if not files:
            return StagedDiff(content="", stat="", files=0)
        stat, _ = self._run(root, "diff", *options, "--stat=120", limit=64_000)
        patch, truncated = self._run(root, "diff", *options)
        return StagedDiff(
            content=patch.decode("utf-8", errors="replace"),
            stat=stat.decode("utf-8", errors="replace").rstrip(),
            files=files,
            truncated=truncated,
        )

    # ── Explicit actions ────────────────────────────────────────────────

    def _run_write(self, root: str, *arguments: str) -> None:
        """Run a Git command that changes the index or history; surface Git's own error text."""
        try:
            result = subprocess.run(
                ["git", "--no-pager", "--literal-pathspecs", "-C", root, *arguments],
                capture_output=True,
                env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
                timeout=60,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise GitCommandError("Git did not finish in time. Check for hooks waiting on input and try again.") from exc
        except OSError as exc:
            raise GitCommandError("Git could not be started on this machine.") from exc
        if result.returncode:
            details = result.stderr.decode("utf-8", errors="replace").strip() or result.stdout.decode("utf-8", errors="replace").strip()
            details = " ".join(details.split())[:600]
            raise GitCommandError(details or "Git rejected the command.")

    def _changed_paths(self, root: str, paths: list[str], *, require_staged: bool) -> list[str]:
        """Validate that every path is a current change; include rename sources so Git sees both sides."""
        if not paths:
            raise GitCommandError("Choose at least one changed file.")
        changes = {change.path: change for change in self._changes(root)}
        pathspecs: list[str] = []
        for path in dict.fromkeys(paths):
            relative = PurePosixPath(path)
            if not path or relative.is_absolute() or ".." in relative.parts or ".git" in relative.parts:
                raise GitCommandError(f"'{path}' is not a changed file inside the repository.")
            change = changes.get(path)
            if change is None:
                raise GitCommandError(f"'{path}' is no longer changed. Refresh the Git status.")
            if require_staged and change.index_status in " ?":
                raise GitCommandError(f"'{path}' has no staged changes.")
            pathspecs.append(path)
            if change.original_path is not None:
                pathspecs.append(change.original_path)
        return pathspecs

    def stage(self, root_path: str, paths: list[str]) -> None:
        repo = self._repository(root_path)
        root = str(repo.working_tree_dir)
        pathspecs = self._changed_paths(root, paths, require_staged=False)
        # -A records deletions and renames for the given paths as well as edits.
        self._run_write(root, "add", "-A", "--", *pathspecs)

    def unstage(self, root_path: str, paths: list[str]) -> None:
        repo = self._repository(root_path)
        root = str(repo.working_tree_dir)
        pathspecs = self._changed_paths(root, paths, require_staged=True)
        if repo.head.is_valid():
            self._run_write(root, "reset", "-q", "HEAD", "--", *pathspecs)
        else:
            # No HEAD yet: the only way to unstage is to drop the paths from the index.
            self._run_write(root, "rm", "-q", "--cached", "-r", "--", *pathspecs)

    def commit(self, root_path: str, message: str) -> GitCommit:
        repo = self._repository(root_path)
        root = str(repo.working_tree_dir)
        text = message.strip()
        if not text:
            raise GitCommandError("Enter a commit message.")
        if len(text) > MAX_COMMIT_MESSAGE_CHARS:
            raise GitCommandError("The commit message is too long.")
        changes = self._changes(root)
        if any(change.index_status == "U" or change.worktree_status == "U" for change in changes):
            raise GitCommandError("Resolve the merge conflicts and stage the files before committing.")
        if not any(change.index_status not in " ?" for change in changes):
            raise GitCommandError("Nothing is staged. Stage changes before committing.")
        self._run_write(root, "commit", "-q", "-m", text)
        try:
            commit = Repo(root).head.commit
        except (GitError, ValueError) as exc:
            raise GitCommandError("The commit was created but could not be read back. Refresh the Git status.") from exc
        return GitCommit(
            commit.hexsha,
            str(commit.message).splitlines()[0] if commit.message else "(No commit message)",
            commit.author.name or "Unknown",
            commit.committed_datetime,
        )

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
