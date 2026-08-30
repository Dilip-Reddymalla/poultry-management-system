from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.face_pipeline import FacePipeline
from app.api.routes import health, recognition

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

logger = logging.getLogger("face_ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Face AI Service Application Lifespan...")
    try:
        pipeline = FacePipeline()
        app.state.pipeline = pipeline
        logger.info("✓ Face AI Pipeline successfully loaded into application state.")
    except Exception as exc:
        logger.error(f"Critical error during Face AI Pipeline startup: {exc}")
        raise exc

    yield

    logger.info("Shutting down Face AI Service...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Production Multi-Face Quality, Liveness & Identity Recognition API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health.router)
app.include_router(recognition.router)


@app.get("/", include_in_schema=False)
def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
    }