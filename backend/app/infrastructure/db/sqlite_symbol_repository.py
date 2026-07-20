"""SQLAlchemy-backed implementation of `SymbolRepositoryPort`."""
from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.domain.models import CodeSymbol, SymbolKind
from app.domain.ports import SymbolRepositoryPort
from app.infrastructure.db.orm_models import SymbolRecord


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
