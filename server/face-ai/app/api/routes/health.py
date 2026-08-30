from __future__ import annotations

from fastapi import APIRouter, Request

from app.core.config import settings
from app.api.schemas.recognition import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def health_check(request: Request) -> HealthResponse:
    pipeline = getattr(request.app.state, "pipeline", None)
    models_loaded = pipeline is not None

    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        models_loaded=models_loaded,
    )
