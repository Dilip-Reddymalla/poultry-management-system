from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.core.config import settings
from app.detection.scrfd_detector import SCRFDDetector
from app.detection.face_alignment import FaceAligner
from app.quality.face_quality import FaceQualityAnalyzer
from app.liveness.liveness import LivenessAnalyzer
from app.recognition.arcface import ArcFaceRecognizer
from app.matching.face_matcher import FaceMatcher
from app.api.schemas.recognition import (
    QualityMetrics,
    QualityResult,
    LivenessResult,
    MatchCandidate,
    RecognitionResult,
    FaceAnalysisResult,
    ImageAnalysisResponse,
)

logger = logging.getLogger("face_ai.pipeline")


class FacePipeline:
    """
    Central orchestrator service for the Face AI pipeline.

    Initializes all ONNX models ONCE during startup:
    1. SCRFD face detection
    2. Light-FaceQ quality analysis
    3. MobileNetV3 liveness anti-spoofing
    4. Face alignment (112x112)
    5. ArcFace (MobileFaceNet) embedding generation
    6. FaceMatcher cosine similarity comparison against known reference identities

    Processes 0, 1, or N faces per image independently.
    """

    def __init__(self) -> None:
        logger.info("Initializing Face AI Pipeline models...")

        # 1. SCRFD Face Detector
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

        # 3. Liveness Analyzer
        self.liveness = LivenessAnalyzer(
            model_path=settings.liveness_model_path,
            live_class_index=1,
            live_threshold=settings.liveness_threshold,
        )
        logger.info("✓ Liveness Analyzer loaded.")

        # 4. Face Aligner
        self.aligner = FaceAligner(output_size=(112, 112))
        logger.info("✓ Face Aligner loaded.")

        # 5. ArcFace Recognizer
        self.recognizer = ArcFaceRecognizer(
            model_path=str(settings.arcface_model_path)
        )
        logger.info("✓ ArcFace Recognizer loaded.")

        # 6. Face Matcher
        self.matcher = FaceMatcher(threshold=settings.match_threshold)
        logger.info("✓ Face Matcher loaded.")

        # 7. Load Reference Identities Database
        self.reference_embeddings: dict[str, list[np.ndarray]] = {}
        self.load_reference_identities(settings.known_faces_dir)

        logger.info("✓ Face AI Pipeline initialization complete.")

    def load_reference_identities(self, known_faces_dir: Path) -> None:
        """
        Load and index reference face embeddings from the known faces directory.
        Supports directory structure:
            known_faces_dir/
                person1/
                    person1_1.jpg
                    person1_2.jpg
                person2/
                    person2_1.jpg
        """
        self.reference_embeddings.clear()
        if not known_faces_dir.exists():
            logger.warning(f"Known faces directory does not exist: {known_faces_dir}")
            return

        image_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        count_identities = 0
        count_images = 0

        for person_dir in known_faces_dir.iterdir():
            if person_dir.is_dir():
                identity_name = person_dir.name
                embeddings = []

                for img_path in person_dir.iterdir():
                    if img_path.suffix.lower() in image_extensions:
                        try:
                            img = cv2.imread(str(img_path))
                            if img is None or img.size == 0:
                                continue

                            detections = self.detector.detect(img)
                            if not detections:
                                continue

                            # Use primary face for reference
                            primary = detections[0]
                            aligned = self.aligner.align_detection(img, primary)
                            if aligned is not None:
                                emb = self.recognizer.get_embedding(aligned)
                                embeddings.append(emb)
                                count_images += 1
                        except Exception as exc:
                            logger.warning(f"Failed to load reference image {img_path}: {exc}")

                if embeddings:
                    self.reference_embeddings[identity_name] = embeddings
                    count_identities += 1

        logger.info(f"Loaded {count_images} reference embeddings across {count_identities} identities.")

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

            # 6. Face Matcher against Known Identity Database
            candidates: list[MatchCandidate] = []
            best_identity: str | None = None
            best_similarity: float = -1.0

            for identity, ref_embs in self.reference_embeddings.items():
                max_sim_for_identity = -1.0
                for ref_emb in ref_embs:
                    sim = self.matcher.cosine_similarity(embedding, ref_emb)
                    if sim > max_sim_for_identity:
                        max_sim_for_identity = sim

                if max_sim_for_identity > 0:
                    candidates.append(
                        MatchCandidate(
                            identity=identity,
                            similarity=float(max_sim_for_identity),
                        )
                    )
                    if max_sim_for_identity > best_similarity:
                        best_similarity = max_sim_for_identity
                        best_identity = identity

            # Sort candidates descending by similarity
            candidates.sort(key=lambda c: c.similarity, reverse=True)

            if best_similarity >= self.matcher.threshold and best_identity is not None:
                rec_status = "MATCHED"
                rec_identity = best_identity
                rec_similarity = float(best_similarity)
            else:
                rec_status = "UNKNOWN"
                rec_identity = None
                rec_similarity = None

            rec_res = RecognitionResult(
                status=rec_status,
                identity=rec_identity,
                similarity=rec_similarity,
                candidates=candidates,
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
