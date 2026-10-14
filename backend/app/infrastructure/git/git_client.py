"""GitPython-backed implementation of `GitClientPort`."""
from __future__ import annotations

import os
from pathlib import Path

from git import InvalidGitRepositoryError, NoSuchPathError, Repo

from app.domain.exceptions import NotAGitRepositoryError
from app.domain.models import RepositoryInfo
from app.domain.ports import GitClientPort

DEFAULT_IGNORE_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "build",
    "dist",
    "target",
    ".dart_tool",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    ".idea",
    ".vscode",
    ".turbo",
    ".cache",
    ".gradle",
    ".pglite",
}

DEFAULT_IGNORE_FILES = {
    ".DS_Store",
    "thumbs.db",
}


class GitPythonClient(GitClientPort):
    def open(self, path: str) -> RepositoryInfo:
        target_path = Path(os.path.expanduser(path)).resolve()
        if not target_path.exists():
            raise NotAGitRepositoryError(f"'{path}' does not exist")
        if not target_path.is_dir():
            raise NotAGitRepositoryError(f"'{path}' is not a directory")

        # 1. Git repository containing the selected folder. Keep the selected
        # folder as the workspace root even when Git lives in a parent folder.
        repo = self._load_repo_or_none(target_path)
        if repo is not None and repo.working_tree_dir:
            return RepositoryInfo(
                name=target_path.name,
                root_path=str(target_path),
                current_branch=self._current_branch(repo),
                head_commit=self._head_commit(repo),
            )

        # 2. Folder containing sub-repositories (multi-repo workspace)
        sub_repos = self._find_sub_repos(target_path)
        if sub_repos:
            branches: list[str] = []
            head_commit: str | None = None
            if len(sub_repos) == 1:
                try:
                    sub_r = Repo(str(sub_repos[0]))
                    branches.append(self._current_branch(sub_r) or "main")
                    head_commit = self._head_commit(sub_r)
                except Exception:
                    branches.append("main")
            else:
                for s in sub_repos:
                    try:
                        sub_r = Repo(str(s))
                        b = self._current_branch(sub_r) or "detached"
                        branches.append(f"{s.name}:{b}")
                    except Exception:
                        branches.append(s.name)

            return RepositoryInfo(
                name=target_path.name,
                root_path=str(target_path),
                current_branch=", ".join(branches) if branches else None,
                head_commit=head_commit,
            )

        # 3. Plain directory without Git
        return RepositoryInfo(
            name=target_path.name,
            root_path=str(target_path),
            current_branch=None,
            head_commit=None,
        )

    def list_tracked_files(self, path: str) -> list[str]:
        target_path = Path(os.path.expanduser(path)).resolve()
        if not target_path.exists() or not target_path.is_dir():
            return []

        # Git reports paths relative to its working tree, while the scanner
        # needs paths relative to the selected folder.
        repo = self._load_repo_or_none(target_path)
        if repo is not None and repo.working_tree_dir:
            tracked = repo.git.ls_files("-z").split("\0")
            untracked = repo.untracked_files  # already excludes .gitignore'd paths
            prefix = target_path.relative_to(Path(repo.working_tree_dir).resolve()).as_posix()
            prefix = "" if prefix == "." else prefix + "/"
            return sorted({
                p.removeprefix(prefix) for p in (*tracked, *untracked)
                if p and (not prefix or p.startswith(prefix))
            })

        # 2. Check for sub-repositories (multi-repo workspace)
        sub_repos = self._find_sub_repos(target_path)
        if sub_repos:
            files: set[str] = set()
            sub_repo_rel_dirs: set[str] = set()
            for sub_dir in sub_repos:
                rel_dir = sub_dir.relative_to(target_path).as_posix()
                sub_repo_rel_dirs.add(rel_dir)
                try:
                    sub_r = Repo(str(sub_dir))
                    tracked = sub_r.git.ls_files().splitlines()
                    untracked = sub_r.untracked_files
                    for f in (*tracked, *untracked):
                        if f:
                            files.add(f"{rel_dir}/{f}")
                except Exception:
                    pass

            # Also collect non-git files directly in root
            loose_files = self._walk_non_git_files(target_path, exclude_subdirs=sub_repo_rel_dirs)
            files.update(loose_files)
            return sorted(files)

        # 3. Plain non-git directory
        return sorted(self._walk_non_git_files(target_path))

    @classmethod
    def _find_sub_repos(cls, root: Path) -> list[Path]:
        sub_repos: list[Path] = []
        try:
            for entry in sorted(root.iterdir()):
                if entry.is_dir() and not entry.name.startswith(".") and (entry / ".git").exists():
                    sub_repos.append(entry)
            if sub_repos:
                return sub_repos

            for entry in sorted(root.iterdir()):
                if entry.is_dir() and not entry.name.startswith(".") and entry.name not in DEFAULT_IGNORE_DIRS:
                    try:
                        for sub in sorted(entry.iterdir()):
                            if sub.is_dir() and not sub.name.startswith(".") and (sub / ".git").exists():
                                sub_repos.append(sub)
                    except (OSError, PermissionError):
                        continue
        except (OSError, PermissionError):
            pass
        return sub_repos

    @classmethod
    def _walk_non_git_files(cls, root: Path, exclude_subdirs: set[str] | None = None) -> set[str]:
        exclude = exclude_subdirs or set()
        collected: set[str] = set()

        spec = cls._load_gitignore_spec(root)

        for current_dir, dirs, files in os.walk(root):
            current_path = Path(current_dir)
            try:
                rel_current = current_path.relative_to(root).as_posix()
            except ValueError:
                continue

            if rel_current != ".":
                parts = rel_current.split("/")
                if any(part in DEFAULT_IGNORE_DIRS or part.startswith(".") for part in parts):
                    dirs.clear()
                    continue
                if any(rel_current == excl or rel_current.startswith(f"{excl}/") for excl in exclude):
                    dirs.clear()
                    continue
                if spec is not None and spec.match_file(f"{rel_current}/"):
                    dirs.clear()
                    continue

            dirs[:] = [
                d for d in dirs
                if not d.startswith(".")
                and d not in DEFAULT_IGNORE_DIRS
                and (f"{rel_current}/{d}" if rel_current != "." else d) not in exclude
                and (spec is None or not spec.match_file(f"{(rel_current + '/' + d) if rel_current != '.' else d}/"))
            ]

            for filename in files:
                if filename.startswith(".") or filename.lower() in DEFAULT_IGNORE_FILES:
                    continue
                rel_file = f"{rel_current}/{filename}" if rel_current != "." else filename
                if spec is not None and spec.match_file(rel_file):
                    continue
                collected.add(rel_file)

        return collected

    @staticmethod
    def _load_gitignore_spec(root: Path):
        gitignore = root / ".gitignore"
        if gitignore.is_file():
            try:
                import pathspec
                with gitignore.open("r", encoding="utf-8", errors="ignore") as f:
                    return pathspec.PathSpec.from_lines("gitwildmatch", f)
            except Exception:
                pass
        return None

    @staticmethod
    def _load_repo_or_none(target_path: Path) -> Repo | None:
        try:
            if (target_path / ".git").exists():
                return Repo(str(target_path))
            return Repo(str(target_path), search_parent_directories=True)
        except (InvalidGitRepositoryError, NoSuchPathError):
            return None

    @staticmethod
    def _current_branch(repo: Repo) -> str | None:
        try:
            return repo.active_branch.name
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _head_commit(repo: Repo) -> str | None:
        try:
            return repo.head.commit.hexsha
        except (ValueError, TypeError):
            return None
