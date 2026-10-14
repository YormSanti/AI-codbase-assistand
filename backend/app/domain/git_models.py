"""Live Git review data, independent of the persisted repository index."""
from dataclasses import dataclass
from datetime import datetime


@dataclass
class GitChange:
    path: str
    index_status: str
    worktree_status: str
    original_path: str | None = None


@dataclass
class GitCommit:
    sha: str
    message: str
    author: str
    committed_at: datetime


@dataclass
class GitStatus:
    branch: str | None
    head_commit: str | None
    upstream: str | None
    ahead: int | None
    behind: int | None
    remote_url: str | None
    changes: list[GitChange]
    commits: list[GitCommit]


@dataclass
class GitDiff:
    path: str
    staged: bool
    content: str
    is_binary: bool = False
    truncated: bool = False
