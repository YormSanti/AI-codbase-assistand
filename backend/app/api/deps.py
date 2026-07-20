"""Dependency-injection wiring for the API layer.

This is the single place that knows how to construct concrete
infrastructure adapters and hand them to services as their abstract port
types — the "composition root" of the app.
"""
from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.infrastructure.db.database import get_session
from app.infrastructure.db.sqlite_repository import SqlAlchemyFileMetadataRepository
from app.infrastructure.db.sqlite_symbol_repository import SqlAlchemySymbolRepository
from app.infrastructure.git.git_client import GitPythonClient
from app.infrastructure.parsing.file_scanner import scan_files
from app.infrastructure.parsing.treesitter_parser import TreeSitterCodeParser
from app.services.indexing_service import IndexingService
from app.services.parsing_service import SymbolExtractionService

DbSession = Annotated[Session, Depends(get_session)]

# Constructing a parser loads its Tree-sitter grammars; built once and
# reused across requests rather than per-request. Fine for a single-user
# desktop tool — would need per-request/thread instances if this ever
# serves concurrent requests from multiple clients.
_code_parser = TreeSitterCodeParser()


def get_indexing_service(session: DbSession) -> Iterator[IndexingService]:
    file_repository = SqlAlchemyFileMetadataRepository(session)
    symbol_repository = SqlAlchemySymbolRepository(session)
    git_client = GitPythonClient()
    symbol_extraction_service = SymbolExtractionService(
        parser=_code_parser, symbol_repository=symbol_repository
    )
    yield IndexingService(
        git_client=git_client,
        file_repository=file_repository,
        scan_files=scan_files,
        symbol_extraction_service=symbol_extraction_service,
    )


IndexingServiceDep = Annotated[IndexingService, Depends(get_indexing_service)]
