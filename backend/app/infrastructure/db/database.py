"""SQLAlchemy engine/session setup.

A single module-level engine is fine for a desktop app talking to a local
SQLite file — there's no connection-pool-across-processes concern here.
`get_session` is a generator so FastAPI's `Depends` can manage the
session lifecycle (commit-on-success, rollback-on-error, always close).
"""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


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
