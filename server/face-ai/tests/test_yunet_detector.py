"""
Unit and integration tests for YuNet face detector.
"""

import sys
from pathlib import Path

FACE_AI_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(FACE_AI_ROOT))

import cv2
import numpy as np
import pytest

from app.core.config import settings
from app.detection.yunet_detector import YuNetDetector


@pytest.fixture
def yunet_detector():
    return YuNetDetector(
        model_path=str(settings.yunet_model_path),
        score_threshold=settings.yunet_score_threshold,
        nms_threshold=settings.yunet_nms_threshold,
    )


def test_yunet_initialization(yunet_detector):
    assert yunet_detector is not None
    assert yunet_detector.detector is not None


def test_yunet_detect_test_image(yunet_detector):
    test_img_path = FACE_AI_ROOT / "test_data" / "test.jpg"
    assert test_img_path.exists(), f"Test image missing: {test_img_path}"

    image = cv2.imread(str(test_img_path))
    assert image is not None

    faces = yunet_detector.detect(image)
    assert len(faces) >= 1, "YuNet should detect at least 1 face in test.jpg"

    face = faces[0]
    assert "bbox" in face
    assert "score" in face
    assert "landmarks" in face

    bbox = face["bbox"]
    assert len(bbox) == 4
    x1, y1, x2, y2 = bbox
    assert 0 <= x1 < x2 <= image.shape[1]
    assert 0 <= y1 < y2 <= image.shape[0]

    landmarks = face["landmarks"]
    assert len(landmarks) == 5
    # Landmarks order: left_eye, right_eye, nose, left_mouth, right_mouth
    left_eye, right_eye, nose, left_mouth, right_mouth = landmarks
    # In image coordinate space (facing the camera):
    # Left eye x should be to the left of right eye x
    assert left_eye[0] < right_eye[0], f"Left eye {left_eye} should have x < right eye {right_eye}"
    # Eyes y should be above nose y (smaller y)
    assert left_eye[1] < nose[1]
    assert right_eye[1] < nose[1]
    # Nose y should be above mouth y
    assert nose[1] < left_mouth[1]
    assert nose[1] < right_mouth[1]


def test_yunet_empty_and_invalid_inputs(yunet_detector):
    assert yunet_detector.detect(None) == []
    assert yunet_detector.detect(np.array([], dtype=np.uint8)) == []
    # Black image (no faces)
    black_img = np.zeros((100, 100, 3), dtype=np.uint8)
    assert yunet_detector.detect(black_img) == []


if __name__ == "__main__":
    detector = YuNetDetector(
        model_path=str(settings.yunet_model_path),
        score_threshold=settings.yunet_score_threshold,
        nms_threshold=settings.yunet_nms_threshold,
    )
    test_img_path = FACE_AI_ROOT / "test_data" / "test.jpg"
    img = cv2.imread(str(test_img_path))
    res = detector.detect(img)
    print(f"Detected {len(res)} face(s) in test.jpg")
    for idx, f in enumerate(res):
        print(f"Face {idx}: score={f['score']:.4f}, bbox={f['bbox']}, landmarks={f['landmarks']}")
