"""Pydantic request/response models — the API's wire format.

Deliberately separate from `app.domain.models`: the domain dataclasses stay
free of HTTP/JSON concerns, and the API is free to shape/version its
contract independently of internal representations.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.models import CodeSymbol, Language, RepositoryInfo, SymbolKind, TreeNode


class OpenRepositoryRequest(BaseModel):
    path: str = Field(..., description="Absolute path to a local Git repository")


class RepositoryResponse(BaseModel):
    id: int
    name: str
    root_path: str
    current_branch: str | None
    head_commit: str | None
    opened_at: datetime | None
    file_count: int

    @classmethod
    def from_domain(cls, info: RepositoryInfo) -> "RepositoryResponse":
        assert info.id is not None
        return cls(
            id=info.id,
            name=info.name,
            root_path=info.root_path,
            current_branch=info.current_branch,
            head_commit=info.head_commit,
            opened_at=info.opened_at,
            file_count=info.file_count,
        )


class TreeNodeResponse(BaseModel):
    name: str
    path: str
    is_directory: bool
    language: Language | None = None
    size_bytes: int | None = None
    file_id: int | None = None
    children: list["TreeNodeResponse"] = Field(default_factory=list)

    @classmethod
    def from_domain(cls, node: TreeNode) -> "TreeNodeResponse":
        return cls(
            name=node.name,
            path=node.path,
            is_directory=node.is_directory,
            language=node.language,
            size_bytes=node.size_bytes,
            file_id=node.file_id,
            children=[cls.from_domain(child) for child in node.children],
        )


class CodeSymbolResponse(BaseModel):
    id: int
    name: str
    kind: SymbolKind
    parent_name: str | None
    start_line: int
    end_line: int

    @classmethod
    def from_domain(cls, symbol: CodeSymbol) -> "CodeSymbolResponse":
        assert symbol.id is not None
        return cls(
            id=symbol.id,
            name=symbol.name,
            kind=symbol.kind,
            parent_name=symbol.parent_name,
            start_line=symbol.start_line,
            end_line=symbol.end_line,
        )


class ErrorResponse(BaseModel):
    detail: str
