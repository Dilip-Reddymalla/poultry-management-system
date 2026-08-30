from __future__ import annotations

from pathlib import Path
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseModel):
    app_name: str = "Face AI Service"
    app_version: str = "1.0.0"
    debug: bool = False

    # Model Paths
    scrfd_model_path: Path = Field(
        default_factory=lambda: PROJECT_ROOT / "models" / "scrfd" / "scrfd_500m_bnkps.onnx"
    )
    arcface_model_path: Path = Field(
        default_factory=lambda: PROJECT_ROOT / "models" / "arcface" / "buffalo_s" / "w600k_mbf.onnx"
    )
    liveness_model_path: Path = Field(
        default_factory=lambda: PROJECT_ROOT / "models" / "liveness" / "modelrgb.onnx"
    )
    quality_model_path: Path = Field(
        default_factory=lambda: PROJECT_ROOT / "models" / "quality" / "face_det_lite.onnx"
    )

    # Reference Identity Embeddings Directory
    known_faces_dir: Path = Field(
        default_factory=lambda: PROJECT_ROOT / "test_data" / "recognition"
    )

    # Detection Parameters
    scrfd_confidence_threshold: float = 0.20
    scrfd_nms_threshold: float = 0.40

    # Quality Parameters
    quality_threshold: float = 0.35
    quality_min_sharpness: float = 15.0
    quality_min_face_width: int = 32
    quality_min_face_height: int = 32
    quality_min_face_area_ratio: float = 0.001
    quality_min_detection_confidence: float = 0.35
    quality_use_sharpness: bool = True

    # Liveness Parameters
    liveness_threshold: float = 0.50
    liveness_crop_scale: float = 2.7

    # Recognition & Matching Parameters
    match_threshold: float = 0.40

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ]

    pass


settings = Settings()

