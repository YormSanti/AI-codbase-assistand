"""SQLAlchemy-backed implementation of `FileMetadataRepositoryPort`.

This is the "Repository pattern" adapter: it is the only place in the
codebase that knows about `RepositoryRecord`/`FileRecord` ORM rows. Services
only ever see the domain dataclasses (`RepositoryInfo`, `FileMetadata`).
"""
from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.domain.models import FileMetadata, Language, RepositoryInfo
from app.domain.ports import FileMetadataRepositoryPort
from app.infrastructure.db.orm_models import FileRecord, RepositoryRecord


def _to_repository_info(record: RepositoryRecord, file_count: int = 0) -> RepositoryInfo:
    return RepositoryInfo(
        id=record.id,
        name=record.name,
        root_path=record.root_path,
        current_branch=record.current_branch,
        head_commit=record.head_commit,
        opened_at=record.opened_at,
        file_count=file_count,
    )


def _to_file_metadata(record: FileRecord) -> FileMetadata:
    return FileMetadata(
        id=record.id,
        repository_id=record.repository_id,
        relative_path=record.relative_path,
        size_bytes=record.size_bytes,
        language=Language(record.language),
        content_hash=record.content_hash,
        is_binary=record.is_binary,
    )


class SqlAlchemyFileMetadataRepository(FileMetadataRepositoryPort):
    def __init__(self, session: Session) -> None:
        self._session = session

    def save_repository(self, info: RepositoryInfo) -> RepositoryInfo:
        record = self._session.scalar(
            select(RepositoryRecord).where(RepositoryRecord.root_path == info.root_path)
        )
        if record is None:
            record = RepositoryRecord(name=info.name, root_path=info.root_path)
            self._session.add(record)

        record.name = info.name
        record.current_branch = info.current_branch
        record.head_commit = info.head_commit

        self._session.flush()
        return _to_repository_info(record)

    def get_repository(self, repository_id: int) -> RepositoryInfo | None:
        record = self._session.get(RepositoryRecord, repository_id)
        if record is None:
            return None
        return _to_repository_info(record, file_count=self._count_files(repository_id))

    def find_repository_by_path(self, root_path: str) -> RepositoryInfo | None:
        record = self._session.scalar(
            select(RepositoryRecord).where(RepositoryRecord.root_path == root_path)
        )
        if record is None:
            return None
        return _to_repository_info(record, file_count=self._count_files(record.id))

    def list_repositories(self) -> list[RepositoryInfo]:
        records = self._session.scalars(select(RepositoryRecord)).all()
        return [_to_repository_info(r, file_count=self._count_files(r.id)) for r in records]

    def replace_files(self, repository_id: int, files: list[FileMetadata]) -> list[FileMetadata]:
        self._session.execute(delete(FileRecord).where(FileRecord.repository_id == repository_id))

        records = [
            FileRecord(
                repository_id=repository_id,
                relative_path=f.relative_path,
                size_bytes=f.size_bytes,
                language=f.language.value,
                content_hash=f.content_hash,
                is_binary=f.is_binary,
            )
            for f in files
        ]
        self._session.add_all(records)
        self._session.flush()
        return [_to_file_metadata(r) for r in records]

    def list_files(self, repository_id: int) -> list[FileMetadata]:
        records = self._session.scalars(
            select(FileRecord).where(FileRecord.repository_id == repository_id)
        ).all()
        return [_to_file_metadata(r) for r in records]

    def _count_files(self, repository_id: int) -> int:
        return self._session.scalar(
            select(func.count()).select_from(FileRecord).where(FileRecord.repository_id == repository_id)
        ) or 0
