"""GitPython-backed implementation of `GitClientPort`."""
from __future__ import annotations

from pathlib import Path

from git import InvalidGitRepositoryError, NoSuchPathError, Repo

from app.domain.exceptions import NotAGitRepositoryError
from app.domain.models import RepositoryInfo
from app.domain.ports import GitClientPort


class GitPythonClient(GitClientPort):
    def open(self, path: str) -> RepositoryInfo:
        repo = self._load_repo(path)
        root_path = repo.working_tree_dir
        if root_path is None:
            raise NotAGitRepositoryError(f"'{path}' has no working tree (bare repository)")

        return RepositoryInfo(
            name=Path(root_path).name,
            root_path=root_path,
            current_branch=self._current_branch(repo),
            head_commit=self._head_commit(repo),
        )

    def list_tracked_files(self, path: str) -> list[str]:
        repo = self._load_repo(path)
        tracked = repo.git.ls_files().splitlines()
        untracked = repo.untracked_files  # already excludes .gitignore'd paths
        return sorted({p for p in (*tracked, *untracked) if p})

    @staticmethod
    def _load_repo(path: str) -> Repo:
        try:
            return Repo(path, search_parent_directories=True)
        except (InvalidGitRepositoryError, NoSuchPathError) as exc:
            raise NotAGitRepositoryError(f"'{path}' is not a Git repository") from exc

    @staticmethod
    def _current_branch(repo: Repo) -> str | None:
        try:
            return repo.active_branch.name
        except TypeError:
            return None  # detached HEAD

    @staticmethod
    def _head_commit(repo: Repo) -> str | None:
        try:
            return repo.head.commit.hexsha
        except ValueError:
            return None  # unborn branch (no commits yet)
