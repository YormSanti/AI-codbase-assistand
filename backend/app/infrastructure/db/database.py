"""SQLAlchemy engine/session setup.

A single module-level engine is fine for a desktop app talking to a local
SQLite file — there's no connection-pool-across-processes concern here.
`get_session` is a generator so FastAPI's `Depends` can manage the
session lifecycle (commit-on-success, rollback-on-error, always close).
"""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, connection_record) -> None:  # noqa: ANN001
    """SQLite ignores FK constraints (and ON DELETE CASCADE) unless told
    otherwise, per-connection. Without this, deleting a repository/file
    would leave orphaned file/symbol rows behind.

    Registered on the generic `Engine` class rather than a specific engine
    so it also covers the separate engines tests create.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    from app.infrastructure.db import orm_models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine)


def get_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
