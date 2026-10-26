"""Code health scan: TODO markers, risky patterns, likely secrets, and large files."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import HealthServiceDep
from app.domain.exceptions import RepositoryNotFoundError
from app.domain.models import HealthReport

router = APIRouter(prefix="/api/repositories", tags=["health"])


@router.get("/{repository_id}/health", response_model=HealthReport)
def scan_health(repository_id: int, service: HealthServiceDep) -> HealthReport:
    """Scan the repository's indexed text files. Secrets are returned redacted."""
    try:
        return service.scan(repository_id)
    except RepositoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
