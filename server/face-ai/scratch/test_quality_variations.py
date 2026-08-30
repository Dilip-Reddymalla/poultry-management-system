"""
Test quality score variations across different image manipulations.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "models" / "quality" / "face_det_lite.onnx"
IMAGE_PATH = PROJECT_ROOT / "test_data" / "recognition" / "person1" / "person1_1.jpg"

SCALE_INPUT = 1.5259021893143654e-05
SCALE_HEATMAP = 0.00011156859545735642
ZERO_POINT_HEATMAP = 47397


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -10.0, 10.0)))


def get_quality_score(session, face_crop: np.ndarray) -> float:
    if len(face_crop.shape) == 3 and face_crop.shape[2] == 3:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = face_crop

    resized = cv2.resize(gray, (640, 480), interpolation=cv2.INTER_LINEAR)
    norm = resized.astype(np.float32) / 255.0
    uint16_tensor = np.round(norm / SCALE_INPUT).astype(np.uint16)
    tensor = np.expand_dims(np.expand_dims(uint16_tensor, axis=0), axis=0)

    heatmap_raw = session.run(None, {"input": tensor})[0]
    heatmap_dequant = (heatmap_raw.astype(np.float32) - ZERO_POINT_HEATMAP) * SCALE_HEATMAP
    heatmap_prob = sigmoid(heatmap_dequant)
    
    # Peak quality score in the face crop
    return float(np.max(heatmap_prob))


def main():
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    img = cv2.imread(str(IMAGE_PATH))

    # Clean face crop
    h, w = img.shape[:2]
    clean_face = img[int(h*0.2):int(h*0.7), int(w*0.2):int(w*0.7)]
    score_clean = get_quality_score(session, clean_face)

    # Blurry face crop
    blurry_face = cv2.GaussianBlur(clean_face, (25, 25), 0)
    score_blurry = get_quality_score(session, blurry_face)

    # Heavily blurred face
    heavy_blur = cv2.GaussianBlur(clean_face, (51, 51), 0)
    score_heavy_blur = get_quality_score(session, heavy_blur)

    # Dark face crop
    dark_face = (clean_face.astype(np.float32) * 0.2).astype(np.uint8)
    score_dark = get_quality_score(session, dark_face)

    # Background crop (non-face)
    bg_crop = img[0:int(h*0.2), 0:int(w*0.2)]
    score_bg = get_quality_score(session, bg_crop)

    print("Quality Score Results (Sigmoid Peak Heatmap):")
    print(f"  Clean Face:       {score_clean:.4f}")
    print(f"  Blurry Face:      {score_blurry:.4f}")
    print(f"  Heavy Blur Face:  {score_heavy_blur:.4f}")
    print(f"  Dark Face:        {score_dark:.4f}")
    print(f"  Background (No):  {score_bg:.4f}")


if __name__ == "__main__":
    main()
