"""
Unit tests for MiniFASNetV2 anti-spoofing analyzer.
"""

import sys
from pathlib import Path

FACE_AI_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(FACE_AI_ROOT))

import cv2
import numpy as np
import pytest

from app.core.config import settings
from app.liveness.minifasnet import MiniFASNetLiveness
from app.detection.yunet_detector import YuNetDetector


@pytest.fixture
def liveness_analyzer():
    return MiniFASNetLiveness(
        model_path=str(settings.minifasnet_model_path),
        live_threshold=settings.liveness_threshold,
    )


def test_minifasnet_initialization(liveness_analyzer):
    assert liveness_analyzer is not None
    assert liveness_analyzer.session is not None
    assert liveness_analyzer.input_shape == ["batch", 3, 80, 80]
    assert liveness_analyzer.output_shape == ["batch", 3]


def test_minifasnet_preprocess(liveness_analyzer):
    dummy_crop = np.random.randint(0, 256, (120, 120, 3), dtype=np.uint8)
    tensor = liveness_analyzer.preprocess(dummy_crop)

    assert tensor.shape == (1, 3, 80, 80)
    assert tensor.dtype == np.float32
    assert tensor.min() >= 0.0 and tensor.max() <= 1.0


def test_minifasnet_analyze(liveness_analyzer):
    test_img_path = FACE_AI_ROOT / "test_data" / "test.jpg"
    assert test_img_path.exists()

    image = cv2.imread(str(test_img_path))
    assert image is not None

    detector = YuNetDetector(model_path=str(settings.yunet_model_path))
    faces = detector.detect(image)
    assert len(faces) > 0

    bbox = faces[0]["bbox"]
    result = liveness_analyzer.analyze(image=image, bbox=bbox)

    assert "decision" in result
    assert result["decision"] in ["LIVE", "SPOOF"]
    assert "score" in result
    assert 0.0 <= result["score"] <= 1.0
    assert "scores" in result
    assert "class_1" in result["scores"]
    assert "live" in result["scores"]
    assert "spoof" in result["scores"]
    assert result["model"] == "MiniFASNetV2"


if __name__ == "__main__":
    analyzer = MiniFASNetLiveness(
        model_path=str(settings.minifasnet_model_path),
        live_threshold=settings.liveness_threshold,
    )
    test_minifasnet_analyze(analyzer)
    print("MiniFASNetV2 test passed successfully.")
