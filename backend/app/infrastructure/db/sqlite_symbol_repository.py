"""SQLAlchemy-backed implementation of `SymbolRepositoryPort`."""
from __future__ import annotations

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from app.domain.models import CodeSymbol, SymbolKind, SymbolMatch
from app.domain.ports import SymbolRepositoryPort
from app.infrastructure.db.orm_models import FileRecord, SymbolRecord


def _to_code_symbol(record: SymbolRecord) -> CodeSymbol:
    return CodeSymbol(
        id=record.id,
        file_id=record.file_id,
        name=record.name,
        kind=SymbolKind(record.kind),
        parent_name=record.parent_name,
        start_line=record.start_line,
        end_line=record.end_line,
    )


class SqlAlchemySymbolRepository(SymbolRepositoryPort):
    def __init__(self, session: Session) -> None:
        self._session = session

    def replace_symbols(self, file_id: int, symbols: list[CodeSymbol]) -> list[CodeSymbol]:
        self._session.execute(delete(SymbolRecord).where(SymbolRecord.file_id == file_id))

        records = [
            SymbolRecord(
                file_id=file_id,
                kind=s.kind.value,
                name=s.name,
                parent_name=s.parent_name,
                start_line=s.start_line,
                end_line=s.end_line,
            )
            for s in symbols
        ]
        self._session.add_all(records)
        self._session.flush()
        return [_to_code_symbol(r) for r in records]

    def list_symbols_for_file(self, file_id: int) -> list[CodeSymbol]:
        records = self._session.scalars(
            select(SymbolRecord).where(SymbolRecord.file_id == file_id)
        ).all()
        return [_to_code_symbol(r) for r in records]

    def count_symbols_by_file(self, repository_id: int) -> dict[int, int]:
        rows = self._session.execute(
            select(SymbolRecord.file_id, func.count())
            .join(FileRecord, FileRecord.id == SymbolRecord.file_id)
            .where(FileRecord.repository_id == repository_id, SymbolRecord.kind != SymbolKind.IMPORT.value)
            .group_by(SymbolRecord.file_id)
        ).all()
        return {file_id: count for file_id, count in rows}

    def search_symbols(self, repository_id: int, query: str, limit: int) -> list[SymbolMatch]:
        needle = query.strip().lower()
        if not needle:
            return []
        escaped = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        name = func.lower(SymbolRecord.name)
        rank = case(
            (name == needle, 0),
            (name.like(f"{escaped}%", escape="\\"), 1),
            else_=2,
        )
        rows = self._session.execute(
            select(SymbolRecord, FileRecord.relative_path)
            .join(FileRecord, FileRecord.id == SymbolRecord.file_id)
            .where(
                FileRecord.repository_id == repository_id,
                SymbolRecord.kind != SymbolKind.IMPORT.value,
                name.like(f"%{escaped}%", escape="\\"),
            )
            .order_by(rank, func.length(SymbolRecord.name), SymbolRecord.name, FileRecord.relative_path, SymbolRecord.start_line)
            .limit(limit)
        ).all()
        return [
            SymbolMatch(
                name=record.name,
                kind=SymbolKind(record.kind),
                path=path,
                start_line=record.start_line,
                end_line=record.end_line,
                parent_name=record.parent_name,
            )
            for record, path in rows
        ]
