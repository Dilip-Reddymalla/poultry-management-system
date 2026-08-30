from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., example="ok")
    service: str = Field(..., example="Face AI Service")
    version: str = Field(..., example="1.0.0")
    models_loaded: bool = Field(..., example=True)


class QualityMetrics(BaseModel):
    face_width: int = Field(..., example=1331)
    face_height: int = Field(..., example=1934)
    face_area: float = Field(..., example=2575206.1)
    relative_area: float = Field(..., example=0.0796)
    detection_confidence: float | None = Field(default=None, example=0.7157)
    sharpness: float | None = Field(default=None, example=63.33)
    landmarks_valid: bool = Field(default=True, example=True)


class QualityResult(BaseModel):
    usable: bool = Field(..., example=True)
    decision: str = Field(..., example="ACCEPT")
    quality_score: float = Field(..., example=0.5284)
    reasons: list[str] = Field(default_factory=list, example=[])
    metrics: QualityMetrics


class LivenessResult(BaseModel):
    decision: str = Field(..., example="LIVE")
    score: float = Field(..., example=0.91)
    scores: dict[str, float] = Field(
        default_factory=dict,
        example={"class_0": 0.09, "class_1": 0.91, "live": 0.91, "spoof": 0.09},
    )


class MatchCandidate(BaseModel):
    identity: str = Field(..., example="person1")
    similarity: float = Field(..., example=0.8523)


class RecognitionResult(BaseModel):
    status: str = Field(
        ...,
        example="MATCHED",
        description="Recognition status: MATCHED | UNKNOWN | SPOOF | REJECTED_LOW_QUALITY",
    )
    identity: str | None = Field(default=None, example="person1")
    similarity: float | None = Field(default=None, example=0.8523)
    candidates: list[MatchCandidate] = Field(default_factory=list)


class FaceAnalysisResult(BaseModel):
    face_index: int = Field(..., example=1)
    bbox: list[float] = Field(..., example=[1295.88, 2035.85, 2627.17, 3970.23])
    detection_confidence: float = Field(..., example=0.7157)
    landmarks: list[list[float]] | None = Field(default=None)
    quality: QualityResult
    liveness: LivenessResult | None = Field(default=None)
    recognition: RecognitionResult
    embedding: list[float] | None = Field(
        default=None,
        description="512-D ArcFace embedding vector. Present only when quality is ACCEPT and liveness is LIVE.",
    )


class ImageAnalysisResponse(BaseModel):
    success: bool = Field(default=True, example=True)
    filename: str = Field(..., example="photo.jpg")
    image_width: int = Field(..., example=1920)
    image_height: int = Field(..., example=1080)
    face_count: int = Field(..., example=1)
    faces: list[FaceAnalysisResult] = Field(default_factory=list)
    process_time_ms: float = Field(..., example=145.2)
