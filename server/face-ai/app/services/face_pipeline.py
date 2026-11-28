from __future__ import annotations

import logging
import time
from typing import Any

import cv2
import numpy as np

from app.core.config import settings
from app.detection.scrfd_detector import SCRFDDetector
from app.detection.yunet_detector import YuNetDetector
from app.detection.face_alignment import FaceAligner
from app.quality.face_quality import FaceQualityAnalyzer
from app.liveness.liveness import LivenessAnalyzer
from app.liveness.minifasnet import MiniFASNetLiveness
from app.recognition.arcface import ArcFaceRecognizer
from app.recognition.edgeface import EdgeFaceRecognizer
from app.api.schemas.recognition import (
    QualityMetrics,
    QualityResult,
    LivenessResult,
    RecognitionResult,
    FaceAnalysisResult,
    ImageAnalysisResponse,
    ProfileEnrollResponse,
)

logger = logging.getLogger("face_ai.pipeline")


class FacePipeline:
    """
    Central orchestrator service for the Face AI pipeline.

    Initializes all ONNX models ONCE during startup:
    1. Face Detection (YuNet / SCRFD)
    2. Light-FaceQ quality analysis
    3. Anti-spoofing Liveness (MiniFASNetV2 / MobileNetV3)
    4. Face alignment (112x112)
    5. Face Recognition embedding generation (EdgeFace / ArcFace)

    Identity matching is intentionally NOT performed here: this microservice only
    produces analysis + embeddings. Search/matching of embeddings is owned by the
    Express API against pgvector (see server/src/services/vector-search.service.ts).

    Processes 0, 1, or N faces per image independently.
    """

    def __init__(self) -> None:
        logger.info("Initializing Face AI Pipeline models...")

        # 1. Face Detector (YuNet / SCRFD)
        if settings.detector_backend.lower() == "yunet":
            self.detector = YuNetDetector(
                model_path=str(settings.yunet_model_path),
                score_threshold=settings.yunet_score_threshold,
                nms_threshold=settings.yunet_nms_threshold,
            )
            logger.info("✓ YuNet Detector loaded.")
        else:
            self.detector = SCRFDDetector(
                model_path=str(settings.scrfd_model_path),
                input_size=(640, 640),
                confidence_threshold=settings.scrfd_confidence_threshold,
                nms_threshold=settings.scrfd_nms_threshold,
            )
            logger.info("✓ SCRFD Detector loaded.")

        # 2. Face Quality Analyzer
        self.quality = FaceQualityAnalyzer(
            model_path=settings.quality_model_path,
            quality_threshold=settings.quality_threshold,
            min_face_width=settings.quality_min_face_width,
            min_face_height=settings.quality_min_face_height,
            min_face_area_ratio=settings.quality_min_face_area_ratio,
            min_detection_confidence=settings.quality_min_detection_confidence,
            min_sharpness=settings.quality_min_sharpness,
            use_sharpness=settings.quality_use_sharpness,
        )
        logger.info("✓ Face Quality Analyzer loaded.")

        # 3. Liveness Analyzer (MiniFASNetV2 / Legacy)
        if settings.liveness_backend.lower() == "minifasnet":
            self.liveness = MiniFASNetLiveness(
                model_path=settings.minifasnet_model_path,
                live_threshold=settings.liveness_threshold,
            )
            logger.info("✓ MiniFASNetV2 Liveness Analyzer loaded.")
        else:
            self.liveness = LivenessAnalyzer(
                model_path=settings.liveness_model_path,
                live_class_index=1,
                live_threshold=settings.liveness_threshold,
            )
            logger.info("✓ Legacy Liveness Analyzer loaded.")

        # 4. Face Aligner
        self.aligner = FaceAligner(output_size=(112, 112))
        logger.info("✓ Face Aligner loaded.")

        # 5. Face Recognizer (EdgeFace / ArcFace)
        if settings.recognizer_backend.lower() == "edgeface":
            self.recognizer = EdgeFaceRecognizer(
                model_path=str(settings.edgeface_model_path)
            )
            logger.info("✓ EdgeFace Recognizer loaded.")
        else:
            self.recognizer = ArcFaceRecognizer(
                model_path=str(settings.arcface_model_path)
            )
            logger.info("✓ ArcFace Recognizer loaded.")

        # Identity matching is not initialized here — it is owned by the Express
        # API (pgvector search). This service only generates analysis + embeddings.

        logger.info("✓ Face AI Pipeline initialization complete.")

    def analyze_image(self, image: np.ndarray, filename: str) -> ImageAnalysisResponse:
        """
        Processes an uploaded image through the complete Face AI pipeline:
            SCRFD -> Quality -> Liveness -> Alignment -> ArcFace -> Matcher

        Evaluates 0, 1, or N faces independently.
        """
        start_time = time.perf_counter()

        if image is None or image.size == 0:
            raise ValueError("Empty or invalid image data provided.")

        img_h, img_w = image.shape[:2]

        # 1. SCRFD Face Detection
        detections = self.detector.detect(image)
        faces_res: list[FaceAnalysisResult] = []

        for idx, det in enumerate(detections, start=1):
            bbox = [float(v) for v in det["bbox"]]
            det_conf = float(det["score"])
            landmarks = det.get("landmarks")
            landmarks_list = (
                [[float(p[0]), float(p[1])] for p in landmarks] if landmarks is not None else None
            )

            # 2. Quality Analysis
            q_raw = self.quality.analyze(
                image=image,
                bbox=bbox,
                landmarks=landmarks,
                detection_confidence=det_conf,
            )

            q_metrics = QualityMetrics(
                face_width=q_raw["metrics"]["face_width"],
                face_height=q_raw["metrics"]["face_height"],
                face_area=q_raw["metrics"]["face_area"],
                relative_area=q_raw["metrics"]["relative_area"],
                detection_confidence=q_raw["metrics"]["detection_confidence"],
                sharpness=q_raw["metrics"]["sharpness"],
                landmarks_valid=q_raw["metrics"]["landmarks_valid"],
            )

            quality_res = QualityResult(
                usable=q_raw["usable"],
                decision=q_raw["decision"],
                quality_score=q_raw["quality_score"],
                reasons=q_raw["reasons"],
                metrics=q_metrics,
            )

            # If Quality REJECTED -> Stop pipeline for this face
            if not q_raw["usable"]:
                rec_res = RecognitionResult(
                    status="REJECTED_LOW_QUALITY",
                    identity=None,
                    similarity=None,
                    candidates=[],
                )
                faces_res.append(
                    FaceAnalysisResult(
                        face_index=idx,
                        bbox=bbox,
                        detection_confidence=det_conf,
                        landmarks=landmarks_list,
                        quality=quality_res,
                        liveness=None,
                        recognition=rec_res,
                        embedding=None,
                    )
                )
                continue

            # 3. Liveness Anti-Spoofing Analysis
            if settings.enable_liveness:
                l_raw = self.liveness.analyze(
                    image=image,
                    bbox=bbox,
                    crop_scale=settings.liveness_crop_scale,
                )

                liveness_res = LivenessResult(
                    decision=l_raw["decision"],
                    score=l_raw["score"],
                    scores=l_raw["scores"],
                )

                # If Liveness SPOOF -> Stop pipeline for this face
                if l_raw["decision"] == "SPOOF":
                    rec_res = RecognitionResult(
                        status="SPOOF",
                        identity=None,
                        similarity=None,
                        candidates=[],
                    )
                    faces_res.append(
                        FaceAnalysisResult(
                            face_index=idx,
                            bbox=bbox,
                            detection_confidence=det_conf,
                            landmarks=landmarks_list,
                            quality=quality_res,
                            liveness=liveness_res,
                            recognition=rec_res,
                            embedding=None,
                        )
                    )
                    continue
            else:
                liveness_res = LivenessResult(
                    decision="LIVE",
                    score=1.0,
                    scores={"SPOOF": 0.0, "LIVE": 1.0},
                )

            # 4. Face Alignment & 5. ArcFace Embedding
            aligned_face = self.aligner.align_detection(image, det)
            if aligned_face is None:
                rec_res = RecognitionResult(
                    status="REJECTED_LOW_QUALITY",
                    identity=None,
                    similarity=None,
                    candidates=[],
                )
                faces_res.append(
                    FaceAnalysisResult(
                        face_index=idx,
                        bbox=bbox,
                        detection_confidence=det_conf,
                        landmarks=landmarks_list,
                        quality=quality_res,
                        liveness=liveness_res,
                        recognition=rec_res,
                        embedding=None,
                    )
                )
                continue

            embedding = self.recognizer.get_embedding(aligned_face)

            # Identity matching is intentionally not performed here. This service
            # produces the embedding; search/matching happens in the Express API
            # against pgvector (server/src/services/vector-search.service.ts). The
            # recognition block only reports that the embedding was produced.
            rec_res = RecognitionResult(
                status="ANALYZED",
                identity=None,
                similarity=None,
                candidates=[],
            )

            faces_res.append(
                FaceAnalysisResult(
                    face_index=idx,
                    bbox=bbox,
                    detection_confidence=det_conf,
                    landmarks=landmarks_list,
                    quality=quality_res,
                    liveness=liveness_res,
                    recognition=rec_res,
                    embedding=embedding.tolist(),
                )
            )

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return ImageAnalysisResponse(
            success=True,
            filename=filename,
            image_width=img_w,
            image_height=img_h,
            face_count=len(faces_res),
            faces=faces_res,
            process_time_ms=round(elapsed_ms, 2),
        )

    def profile_enroll(self, image: np.ndarray, filename: str) -> ProfileEnrollResponse:
        """
        Profile enrollment pipeline.

        Runs the full face analysis, then selects the single best face for
        profile embedding storage.  Selection criteria (composite score):
          - **Centrality (70%)**: How close the face bounding-box center is to
            the image center.  A face dead-center scores 1.0.
          - **Detection confidence (30%)**: The SCRFD detection confidence.

        Only faces that pass quality and liveness are eligible.
        """
        # Run the standard analysis first.
        full_result = self.analyze_image(image, filename)

        if full_result.face_count == 0:
            return ProfileEnrollResponse(
                success=True,
                filename=filename,
                image_width=full_result.image_width,
                image_height=full_result.image_height,
                total_faces_detected=0,
                selected_face=None,
                selection_reason="No faces detected in the image.",
                process_time_ms=full_result.process_time_ms,
            )

        # Filter to faces that have a usable embedding (passed quality + liveness).
        eligible = [f for f in full_result.faces if f.embedding is not None]

        if not eligible:
            return ProfileEnrollResponse(
                success=True,
                filename=filename,
                image_width=full_result.image_width,
                image_height=full_result.image_height,
                total_faces_detected=full_result.face_count,
                selected_face=None,
                selection_reason=(
                    f"{full_result.face_count} face(s) detected but none passed "
                    "quality and liveness checks."
                ),
                process_time_ms=full_result.process_time_ms,
            )

        if len(eligible) == 1:
            face = eligible[0]
            return ProfileEnrollResponse(
                success=True,
                filename=filename,
                image_width=full_result.image_width,
                image_height=full_result.image_height,
                total_faces_detected=full_result.face_count,
                selected_face=face,
                selection_reason=(
                    f"Single usable face #{face.face_index} selected "
                    f"(confidence {face.detection_confidence:.2f})."
                ),
                process_time_ms=full_result.process_time_ms,
            )

        # Multiple eligible faces — score each by centrality + confidence.
        img_cx = full_result.image_width / 2.0
        img_cy = full_result.image_height / 2.0
        # Max possible distance from center (corner to center).
        max_dist = ((img_cx ** 2) + (img_cy ** 2)) ** 0.5

        best_face = None
        best_score = -1.0
        best_centrality = 0.0
        best_conf = 0.0

        for face in eligible:
            x1, y1, x2, y2 = face.bbox[0], face.bbox[1], face.bbox[2], face.bbox[3]
            face_cx = (x1 + x2) / 2.0
            face_cy = (y1 + y2) / 2.0
            dist = ((face_cx - img_cx) ** 2 + (face_cy - img_cy) ** 2) ** 0.5
            centrality = 1.0 - (dist / max_dist) if max_dist > 0 else 1.0
            conf = face.detection_confidence

            # Composite: 70% centrality, 30% confidence.
            composite = 0.7 * centrality + 0.3 * conf

            if composite > best_score:
                best_score = composite
                best_face = face
                best_centrality = centrality
                best_conf = conf

        if best_face is None:
            # Defensive: unreachable while `eligible` is non-empty, but must not
            # rely on `assert` (which is stripped under `python -O`).
            raise RuntimeError("Face selection failed unexpectedly (no eligible face).")

        return ProfileEnrollResponse(
            success=True,
            filename=filename,
            image_width=full_result.image_width,
            image_height=full_result.image_height,
            total_faces_detected=full_result.face_count,
            selected_face=best_face,
            selection_reason=(
                f"Selected face #{best_face.face_index} from {len(eligible)} eligible faces: "
                f"highest composite score (centrality {best_centrality:.2f}, "
                f"confidence {best_conf:.2f})."
            ),
            process_time_ms=full_result.process_time_ms,
        )
