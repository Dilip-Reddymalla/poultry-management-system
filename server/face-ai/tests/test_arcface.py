from pathlib import Path

import cv2
import numpy as np

from app.recognition.arcface import ArcFaceRecognizer


PROJECT_ROOT = Path(__file__).resolve().parents[1]

MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "arcface"
    / "buffalo_s"
    / "w600k_mbf.onnx"
)

IMAGE_PATH = (
    PROJECT_ROOT
    / "test_data"
    / "test.jpg"
)


def main():
    print("=" * 60)
    print("MOBILEFACENET / ARCFACE EMBEDDING TEST")
    print("=" * 60)

    # ---------------------------------------------------------
    # 1. Load model
    # ---------------------------------------------------------

    print("\n1. Loading ArcFace model...")

    recognizer = ArcFaceRecognizer(
        str(MODEL_PATH)
    )

    # ---------------------------------------------------------
    # 2. Load image
    # ---------------------------------------------------------

    print("\n2. Loading image...")
    print(f"Image: {IMAGE_PATH}")

    face = cv2.imread(str(IMAGE_PATH))

    if face is None:
        raise FileNotFoundError(
            f"Could not read image: {IMAGE_PATH}"
        )

    print(f"Image shape: {face.shape}")

    # ---------------------------------------------------------
    # 3. Generate embedding
    # ---------------------------------------------------------

    print("\n3. Generating embedding...")

    embedding = recognizer.get_embedding(face)

    # ---------------------------------------------------------
    # 4. Inspect embedding
    # ---------------------------------------------------------

    print("\n4. Embedding information")

    print(f"Shape: {embedding.shape}")
    print(f"Dtype: {embedding.dtype}")

    print(f"Min:  {embedding.min():.6f}")
    print(f"Max:  {embedding.max():.6f}")
    print(f"Mean: {embedding.mean():.6f}")

    norm = np.linalg.norm(embedding)

    print(f"L2 norm: {norm:.6f}")

    print("\nFirst 20 values:")

    for i, value in enumerate(embedding[:20]):
        print(f"  [{i:02d}] {value:.6f}")

    # ---------------------------------------------------------
    # 5. Validate
    # ---------------------------------------------------------

    print("\n5. Validation")

    assert embedding.shape == (512,), (
        f"Expected (512,), got {embedding.shape}"
    )

    assert embedding.dtype == np.float32, (
        f"Expected float32, got {embedding.dtype}"
    )

    assert np.isfinite(embedding).all(), (
        "Embedding contains NaN or infinity"
    )

    assert abs(norm - 1.0) < 1e-5, (
        f"Embedding is not normalized. Norm={norm}"
    )

    print("✓ Embedding dimension: 512")
    print("✓ Embedding dtype: float32")
    print("✓ No NaN/Inf values")
    print("✓ L2 normalized")

    print("\n" + "=" * 60)
    print("ARCFACE TEST PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()