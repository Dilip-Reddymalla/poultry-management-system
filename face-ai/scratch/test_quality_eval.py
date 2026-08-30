"""
Test script to inspect dequantized output of face_det_lite.onnx on face_crop.
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

SCALE_BBOX = 0.0012028587516397238
ZERO_POINT_BBOX = 2261

SCALE_LANDMARK = 0.0007150633609853685
ZERO_POINT_LANDMARK = 25230


def preprocess(face_crop: np.ndarray) -> np.ndarray:
    # 1. Convert BGR to Grayscale
    if len(face_crop.shape) == 3 and face_crop.shape[2] == 3:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = face_crop

    # 2. Resize to (640, 480) [Width=640, Height=480]
    resized = cv2.resize(gray, (640, 480), interpolation=cv2.INTER_LINEAR)

    # 3. Convert [0..255] float [0.0..1.0] -> uint16 with quantization scale
    norm = resized.astype(np.float32) / 255.0
    uint16_tensor = np.round(norm / SCALE_INPUT).astype(np.uint16)
    
    # 4. Shape [1, 1, 480, 640]
    tensor = np.expand_dims(np.expand_dims(uint16_tensor, axis=0), axis=0)
    return tensor


def dequantize(arr: np.ndarray, zero_point: float, scale: float) -> np.ndarray:
    return (arr.astype(np.float32) - zero_point) * scale


def main():
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    
    img = cv2.imread(str(IMAGE_PATH))
    if img is None:
        print("Image not found")
        return

    # Take a crop near face
    h, w = img.shape[:2]
    face_crop = img[int(h*0.2):int(h*0.7), int(w*0.2):int(w*0.7)]
    
    tensor = preprocess(face_crop)
    print("Input tensor shape:", tensor.shape, "dtype:", tensor.dtype, "min:", tensor.min(), "max:", tensor.max())

    outputs = session.run(None, {"input": tensor})
    heatmap_raw, bbox_raw, landmark_raw = outputs

    heatmap = dequantize(heatmap_raw, ZERO_POINT_HEATMAP, SCALE_HEATMAP)
    bbox = dequantize(bbox_raw, ZERO_POINT_BBOX, SCALE_BBOX)
    landmark = dequantize(landmark_raw, ZERO_POINT_LANDMARK, SCALE_LANDMARK)

    print("\nDequantized Heatmap:")
    print(f"  Shape: {heatmap.shape}")
    print(f"  Min: {heatmap.min():.6f}, Max: {heatmap.max():.6f}, Mean: {heatmap.mean():.6f}")

    print("\nDequantized BBox:")
    print(f"  Shape: {bbox.shape}")
    print(f"  Min: {bbox.min():.6f}, Max: {bbox.max():.6f}")

    print("\nDequantized Landmark:")
    print(f"  Shape: {landmark.shape}")
    print(f"  Min: {landmark.min():.6f}, Max: {landmark.max():.6f}")

    # Now let's test a non-face / random noise image
    noise = np.random.randint(0, 256, (480, 640, 3), dtype=np.uint8)
    tensor_noise = preprocess(noise)
    outputs_noise = session.run(None, {"input": tensor_noise})
    heatmap_noise = dequantize(outputs_noise[0], ZERO_POINT_HEATMAP, SCALE_HEATMAP)
    print("\nNoise Heatmap:")
    print(f"  Min: {heatmap_noise.min():.6f}, Max: {heatmap_noise.max():.6f}, Mean: {heatmap_noise.mean():.6f}")

    # Test black image
    black = np.zeros((480, 640, 3), dtype=np.uint8)
    tensor_black = preprocess(black)
    outputs_black = session.run(None, {"input": tensor_black})
    heatmap_black = dequantize(outputs_black[0], ZERO_POINT_HEATMAP, SCALE_HEATMAP)
    print("\nBlack Image Heatmap:")
    print(f"  Min: {heatmap_black.min():.6f}, Max: {heatmap_black.max():.6f}, Mean: {heatmap_black.mean():.6f}")


if __name__ == "__main__":
    main()
