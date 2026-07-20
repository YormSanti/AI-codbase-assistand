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
from app.infrastructure.git.git_client import GitPythonClient
from app.infrastructure.parsing.file_scanner import scan_files
from app.services.indexing_service import IndexingService

DbSession = Annotated[Session, Depends(get_session)]


def get_indexing_service(session: DbSession) -> Iterator[IndexingService]:
    file_repository = SqlAlchemyFileMetadataRepository(session)
    git_client = GitPythonClient()
    yield IndexingService(git_client=git_client, file_repository=file_repository, scan_files=scan_files)


IndexingServiceDep = Annotated[IndexingService, Depends(get_indexing_service)]
