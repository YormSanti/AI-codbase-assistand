"""Domain models for repository indexing.

These are plain dataclasses with zero dependency on FastAPI, SQLAlchemy or
GitPython. They describe the concepts DevPilot reasons about, independent of
how they are transported (API) or persisted (SQLite).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class Language(str, Enum):
    PYTHON = "python"
    TYPESCRIPT = "typescript"
    JAVASCRIPT = "javascript"
    TSX = "tsx"
    JSX = "jsx"
    RUST = "rust"
    GO = "go"
    JAVA = "java"
    C = "c"
    CPP = "cpp"
    CSHARP = "csharp"
    RUBY = "ruby"
    PHP = "php"
    JSON = "json"
    YAML = "yaml"
    TOML = "toml"
    MARKDOWN = "markdown"
    HTML = "html"
    CSS = "css"
    SHELL = "shell"
    SQL = "sql"
    OTHER = "other"


@dataclass(frozen=True, slots=True)
class FileMetadata:
    """A single indexed file within a repository."""

    relative_path: str
    size_bytes: int
    language: Language
    content_hash: str
    is_binary: bool
    id: int | None = None
    repository_id: int | None = None

    @property
    def name(self) -> str:
        return self.relative_path.rsplit("/", 1)[-1]

    @property
    def directory(self) -> str:
        if "/" not in self.relative_path:
            return ""
        return self.relative_path.rsplit("/", 1)[0]


class SymbolKind(str, Enum):
    CLASS = "class"
    FUNCTION = "function"
    METHOD = "method"
    IMPORT = "import"


@dataclass(frozen=True, slots=True)
class CodeSymbol:
    """A class, function/method, or import statement extracted from a file."""

    name: str
    kind: SymbolKind
    start_line: int
    end_line: int
    parent_name: str | None = None
    id: int | None = None
    file_id: int | None = None


@dataclass(frozen=True, slots=True)
class RepositoryInfo:
    """Metadata about an opened Git repository."""

    name: str
    root_path: str
    current_branch: str | None
    head_commit: str | None
    id: int | None = None
    opened_at: datetime | None = None
    file_count: int = 0


@dataclass(frozen=True, slots=True)
class TreeNode:
    """A node in the displayable repository tree (file or directory)."""

    name: str
    path: str
    is_directory: bool
    language: Language | None = None
    size_bytes: int | None = None
    file_id: int | None = None
    children: list["TreeNode"] = field(default_factory=list)
