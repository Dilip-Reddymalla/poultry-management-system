from __future__ import annotations

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from app.api.schemas.recognition import ImageAnalysisResponse, ProfileEnrollResponse
from app.services.face_pipeline import FacePipeline

router = APIRouter(prefix="/api/v1/recognition", tags=["Face Recognition"])

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
# Cap decoded dimensions so a highly-compressed file cannot decompress into a
# huge in-memory array (decompression-amplification guard).
MAX_IMAGE_DIMENSION = 4096


async def _load_image(file: UploadFile) -> tuple[np.ndarray, str]:
    """Validate and decode an uploaded image; returns (image, filename)."""
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file was uploaded.",
        )

    contents = await file.read()

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None or image.size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to decode uploaded image. File may be corrupt or an unsupported format.",
        )

    height, width = image.shape[:2]
    if max(height, width) > MAX_IMAGE_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Image dimensions ({width}x{height}) exceed the maximum allowed "
                f"({MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION})."
            ),
        )

    return image, file.filename


def _get_pipeline(request: Request) -> FacePipeline:
    pipeline = getattr(request.app.state, "pipeline", None)
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face AI pipeline service is not initialized.",
        )
    return pipeline


@router.post(
    "/analyze",
    response_model=ImageAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze image for faces, quality, liveness, and embedding",
)
async def analyze_image(
    request: Request,
    file: UploadFile = File(..., description="Image file (JPG, PNG, WEBP)"),
) -> ImageAnalysisResponse:
    image, filename = await _load_image(file)
    try:
        return _get_pipeline(request).analyze_image(image, filename)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(exc)}",
        )


@router.post(
    "/profile-enroll",
    response_model=ProfileEnrollResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze image and select the single best face for profile enrollment",
    description=(
        "Runs the full face detection, quality, liveness, and embedding pipeline, "
        "then selects the most centered, highest-confidence face. Designed for "
        "employee / worker profile photo uploads where only one face embedding "
        "should be stored."
    ),
)
async def profile_enroll(
    request: Request,
    file: UploadFile = File(..., description="Image file (JPG, PNG, WEBP)"),
) -> ProfileEnrollResponse:
    image, filename = await _load_image(file)
    try:
        return _get_pipeline(request).profile_enroll(image, filename)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing profile enrollment: {str(exc)}",
        )
