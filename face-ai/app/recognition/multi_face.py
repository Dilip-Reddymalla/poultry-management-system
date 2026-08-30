from typing import List, Dict, Any, Optional
import numpy as np

from app.detection.scrfd_detector import SCRFDDetector
from app.detection.face_alignment import FaceAligner
from app.recognition.arcface import ArcFaceRecognizer
from app.matching.face_matcher import FaceMatcher


def extract_all_faces(
    image: np.ndarray,
    detector: SCRFDDetector,
    aligner: FaceAligner,
    recognizer: ArcFaceRecognizer,
) -> List[Dict[str, Any]]:
    """
    Extract all faces detected in an image along with their aligned crops and embeddings.

    Parameters
    ----------
    image : np.ndarray
        Input BGR OpenCV image.
    detector : SCRFDDetector
        SCRFD face detector instance.
    aligner : FaceAligner
        Face aligner instance (112x112 output).
    recognizer : ArcFaceRecognizer
        MobileFaceNet/ArcFace embedding recognizer.

    Returns
    -------
    List[Dict[str, Any]]
        List of face records, each containing:
        - "score": float
        - "bbox": List[float]
        - "landmarks": List[List[float]]
        - "aligned_face": np.ndarray (112, 112, 3)
        - "embedding": np.ndarray (512,) float32
    """
    if image is None or image.size == 0:
        raise ValueError("Invalid or empty input image provided to extract_all_faces.")

    detections = detector.detect(image)
    face_records = []

    for detection in detections:
        aligned_face = aligner.align_detection(image, detection)

        if aligned_face is None or aligned_face.shape != (112, 112, 3):
            raise RuntimeError(
                f"Failed to generate 112x112 aligned face crop for detection score {detection.get('score')}."
            )

        embedding = recognizer.get_embedding(aligned_face)

        if embedding.shape != (512,):
            raise ValueError(f"Expected embedding shape (512,), got {embedding.shape}")

        if embedding.dtype != np.float32:
            raise TypeError(f"Expected embedding dtype float32, got {embedding.dtype}")

        if not np.isfinite(embedding).all():
            raise ValueError("Generated face embedding contains non-finite values (NaN/Inf).")

        norm = float(np.linalg.norm(embedding))
        if not np.isclose(norm, 1.0, atol=1e-3):
            raise ValueError(f"Embedding L2 norm ({norm:.6f}) is not approximately 1.0")

        face_records.append({
            "score": float(detection["score"]),
            "bbox": detection["bbox"],
            "landmarks": detection["landmarks"],
            "aligned_face": aligned_face,
            "embedding": embedding,
        })

    return face_records


def recognize_faces(
    image: np.ndarray,
    detector: SCRFDDetector,
    aligner: FaceAligner,
    recognizer: ArcFaceRecognizer,
    matcher: FaceMatcher,
    references: Dict[str, np.ndarray],
) -> List[Dict[str, Any]]:
    """
    Detect, align, extract embeddings, and recognize all faces in an image against reference identities.

    Parameters
    ----------
    image : np.ndarray
        Input BGR OpenCV image.
    detector : SCRFDDetector
        SCRFD face detector instance.
    aligner : FaceAligner
        Face aligner instance.
    recognizer : ArcFaceRecognizer
        Embedding recognizer.
    matcher : FaceMatcher
        Face matcher instance with threshold.
    references : Dict[str, np.ndarray]
        Mapping of identity name -> normalized 512-D prototype embedding.

    Returns
    -------
    List[Dict[str, Any]]
        List of face recognition results:
        - "score": float
        - "bbox": List[float]
        - "landmarks": List[List[float]]
        - "aligned_face": np.ndarray
        - "embedding": np.ndarray
        - "similarities": Dict[str, float]
        - "best_identity": str
        - "best_similarity": float
        - "matched": bool
        - "identity": str ("UNKNOWN" if similarity < threshold)
    """
    face_records = extract_all_faces(image, detector, aligner, recognizer)
    recognition_results = []

    for face in face_records:
        emb = face["embedding"]
        similarities = {}
        best_identity = "UNKNOWN"
        best_similarity = -1.0

        for identity, ref_emb in references.items():
            sim = matcher.cosine_similarity(emb, ref_emb)
            similarities[identity] = sim

            if sim > best_similarity:
                best_similarity = sim
                best_identity = identity

        matched = best_similarity >= matcher.threshold
        assigned_identity = best_identity if matched else "UNKNOWN"

        rec_record = dict(face)
        rec_record.update({
            "similarities": similarities,
            "best_identity": best_identity,
            "best_similarity": best_similarity,
            "matched": matched,
            "identity": assigned_identity,
        })
        recognition_results.append(rec_record)

    return recognition_results
