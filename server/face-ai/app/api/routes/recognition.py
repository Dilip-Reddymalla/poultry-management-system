from __future__ import annotations

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from app.api.schemas.recognition import ImageAnalysisResponse, ProfileEnrollResponse
from app.services.face_pipeline import FacePipeline

router = APIRouter(prefix="/api/v1/recognition", tags=["Face Recognition"])

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post(
    "/analyze",
    response_model=ImageAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze image for faces, quality, liveness, and identity matching",
)
async def analyze_image(
    request: Request,
    file: UploadFile = File(..., description="Image file (JPG, PNG, WEBP)"),
) -> ImageAnalysisResponse:
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file was uploaded.",
        )

    # Read image contents
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

    # Attempt OpenCV image decoding
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None or image.size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to decode uploaded image. File may be corrupt or an unsupported format.",
        )

    pipeline: FacePipeline = getattr(request.app.state, "pipeline", None)
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face AI pipeline service is not initialized.",
        )

    try:
        response = pipeline.analyze_image(image, file.filename)
        return response
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

    pipeline: FacePipeline = getattr(request.app.state, "pipeline", None)
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face AI pipeline service is not initialized.",
        )

    try:
        response = pipeline.profile_enroll(image, file.filename)
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing profile enrollment: {str(exc)}",
        )
