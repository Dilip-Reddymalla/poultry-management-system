"""
Unit and integration tests for EdgeFace face recognizer.
"""

import sys
from pathlib import Path

FACE_AI_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(FACE_AI_ROOT))

import cv2
import numpy as np
import pytest

from app.core.config import settings
from app.recognition.edgeface import EdgeFaceRecognizer
from app.detection.face_alignment import FaceAligner
from app.detection.yunet_detector import YuNetDetector
from app.matching.face_matcher import FaceMatcher


@pytest.fixture
def edgeface_recognizer():
    return EdgeFaceRecognizer(model_path=str(settings.edgeface_model_path))


@pytest.fixture
def detector_and_aligner():
    detector = YuNetDetector(model_path=str(settings.yunet_model_path))
    aligner = FaceAligner(output_size=(112, 112))
    return detector, aligner


def test_edgeface_initialization(edgeface_recognizer):
    assert edgeface_recognizer is not None
    assert edgeface_recognizer.session is not None


def test_edgeface_preprocess(edgeface_recognizer):
    dummy_crop = np.random.randint(0, 256, (112, 112, 3), dtype=np.uint8)
    tensor = edgeface_recognizer.preprocess(dummy_crop)

    assert tensor.shape == (1, 3, 112, 112)
    assert tensor.dtype == np.float32
    assert tensor.min() >= -1.01 and tensor.max() <= 1.01


def test_edgeface_embedding_properties(edgeface_recognizer):
    dummy_crop = np.random.randint(0, 256, (112, 112, 3), dtype=np.uint8)
    emb = edgeface_recognizer.get_embedding(dummy_crop)

    assert emb.shape == (512,)
    assert emb.dtype == np.float32
    norm = np.linalg.norm(emb)
    assert np.isclose(norm, 1.0, atol=1e-5), f"Embedding norm {norm} should be 1.0"


def test_edgeface_identity_separation(edgeface_recognizer, detector_and_aligner):
    detector, aligner = detector_and_aligner
    rec_dir = FACE_AI_ROOT / "test_data" / "recognition"

    p1_1_path = rec_dir / "person1" / "person1_1.jpg"
    p1_2_path = rec_dir / "person1" / "person1_2.jpg"
    p2_1_path = rec_dir / "person2" / "person2_1.jpg"

    assert p1_1_path.exists() and p1_2_path.exists() and p2_1_path.exists()

    def get_face_emb(path: Path) -> np.ndarray:
        img = cv2.imread(str(path))
        faces = detector.detect(img)
        assert len(faces) > 0, f"No face detected in {path}"
        aligned = aligner.align_detection(img, faces[0])
        assert aligned is not None
        return edgeface_recognizer.get_embedding(aligned)

    emb_p1_1 = get_face_emb(p1_1_path)
    emb_p1_2 = get_face_emb(p1_2_path)
    emb_p2_1 = get_face_emb(p2_1_path)

    matcher = FaceMatcher()
    sim_genuine = matcher.cosine_similarity(emb_p1_1, emb_p1_2)
    sim_impostor = matcher.cosine_similarity(emb_p1_1, emb_p2_1)

    print(f"\nEdgeFace Similarity -> Genuine (p1_1 vs p1_2): {sim_genuine:.4f}, Impostor (p1_1 vs p2_1): {sim_impostor:.4f}")
    assert sim_genuine > 0.50, f"Genuine similarity {sim_genuine:.4f} should be > 0.50"
    assert sim_impostor < 0.40, f"Impostor similarity {sim_impostor:.4f} should be < 0.40"
    assert sim_genuine - sim_impostor > 0.30, "Clear separation between genuine and impostor"


if __name__ == "__main__":
    rec = EdgeFaceRecognizer(model_path=str(settings.edgeface_model_path))
    det = YuNetDetector(model_path=str(settings.yunet_model_path))
    aln = FaceAligner()
    test_edgeface_identity_separation(rec, (det, aln))
