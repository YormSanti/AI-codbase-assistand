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
class FileHistory:
    path: str
    """The file's path relative to the Git repository root (it may differ from the editor's path)."""
    commits: list[GitCommit]
    """Newest first, following renames."""


@dataclass
class BranchInfo:
    name: str
    upstream: str | None
    subject: str
    committed_at: datetime | None


@dataclass
class BranchList:
    current: str | None
    """The checked-out branch, including a branch without commits yet; None when HEAD is detached."""
    detached: bool
    branches: list[BranchInfo]
    """Local branches, most recently committed first."""


@dataclass
class CommitFile:
    path: str
    status: str
    """A (added), M (modified), D (deleted), R (renamed), C (copied), or T (type change)."""
    original_path: str | None = None
    additions: int | None = None
    """None for binary files."""
    deletions: int | None = None


@dataclass
class CommitDetails:
    sha: str
    message: str
    author: str
    author_email: str
    committed_at: datetime
    parents: list[str]
    files: list[CommitFile]


@dataclass
class StagedDiff:
    """Everything staged for the next commit, for review or commit-message drafting."""

    content: str
    stat: str
    files: int
    truncated: bool = False


@dataclass
class GitDiff:
    path: str
    staged: bool
    content: str
    is_binary: bool = False
    truncated: bool = False
