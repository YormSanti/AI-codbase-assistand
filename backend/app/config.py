"""Application configuration.

Centralised, environment-overridable settings. Kept separate from the
domain/service layers so infrastructure concerns (where the DB file lives,
what origins the API allows) never leak into business logic.
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DEVPILOT_", env_file=".env")

    app_name: str = "DevPilot AI"
    database_path: Path = Path(__file__).resolve().parent.parent / "data" / "devpilot.db"
    cors_origins: list[str] = ["http://localhost:1420", "http://localhost:5173"]

    @property
    def database_url(self) -> str:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{self.database_path}"


settings = Settings()
