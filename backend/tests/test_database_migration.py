from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool

from app.infrastructure.db.database import Base, migrate_schema
from app.infrastructure.db import orm_models  # noqa: F401  (register mappers)


def _engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    return engine


def test_migrate_schema_adds_columns_missing_from_older_databases() -> None:
    engine = _engine()
    with engine.begin() as connection:
        connection.exec_driver_sql("ALTER TABLE files DROP COLUMN mtime_ns")
    assert "mtime_ns" not in {column["name"] for column in inspect(engine).get_columns("files")}

    assert migrate_schema(engine) == ["files.mtime_ns"]

    assert "mtime_ns" in {column["name"] for column in inspect(engine).get_columns("files")}
    assert migrate_schema(engine) == []  # idempotent


def test_migrate_schema_is_a_no_op_before_tables_exist() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    assert migrate_schema(engine) == []
