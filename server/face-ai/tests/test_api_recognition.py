"""
API Recognition Endpoint Unit Tests.
"""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app

client = TestClient(app)
IMAGE_PATH = PROJECT_ROOT / "test_data" / "recognition" / "person1" / "person1_1.jpg"


def test_analyze_valid_image():
    assert IMAGE_PATH.exists(), f"Test image missing: {IMAGE_PATH}"

    with open(IMAGE_PATH, "rb") as f:
        files = {"file": ("person1_1.jpg", f, "image/jpeg")}
        response = client.post("/api/v1/recognition/analyze", files=files)

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["filename"] == "person1_1.jpg"
    assert data["image_width"] > 0
    assert data["image_height"] > 0
    assert data["face_count"] > 0
    assert len(data["faces"]) == data["face_count"]

    face = data["faces"][0]
    assert "face_index" in face
    assert "bbox" in face
    assert "detection_confidence" in face
    assert "quality" in face
    assert "recognition" in face
    assert face["quality"]["usable"] in (True, False)
    assert face["recognition"]["status"] in (
        "MATCHED",
        "UNKNOWN",
        "SPOOF",
        "REJECTED_LOW_QUALITY",
    )


def test_analyze_invalid_bytes():
    files = {"file": ("corrupt.jpg", b"invalid corrupt image bytes", "image/jpeg")}
    response = client.post("/api/v1/recognition/analyze", files=files)

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_analyze_empty_file():
    files = {"file": ("empty.jpg", b"", "image/jpeg")}
    response = client.post("/api/v1/recognition/analyze", files=files)

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
