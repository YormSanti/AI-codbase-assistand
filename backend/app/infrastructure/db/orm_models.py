"""SQLAlchemy ORM models (infrastructure concern — not domain models)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RepositoryRecord(Base):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    root_path: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    current_branch: Mapped[str | None] = mapped_column(String, nullable=True)
    head_commit: Mapped[str | None] = mapped_column(String, nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    files: Mapped[list["FileRecord"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )


class FileRecord(Base):
    __tablename__ = "files"
    __table_args__ = (UniqueConstraint("repository_id", "relative_path", name="uq_file_per_repo"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), nullable=False)
    relative_path: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    language: Mapped[str] = mapped_column(String, nullable=False)
    content_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_binary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    repository: Mapped["RepositoryRecord"] = relationship(back_populates="files")
