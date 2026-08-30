import sys
from pathlib import Path

# Add face-ai project root to Python import path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np

from app.detection.scrfd_detector import SCRFDDetector
from app.detection.face_alignment import FaceAligner
from app.recognition.arcface import ArcFaceRecognizer


SCRFD_MODEL = PROJECT_ROOT / "models/scrfd/scrfd_500m_bnkps.onnx"

ARCFACE_MODEL = (
    PROJECT_ROOT
    / "models"
    / "arcface"
    / "buffalo_s"
    / "w600k_mbf.onnx"
)

IMAGE_PATH = PROJECT_ROOT / "test_data/test.jpg"


def main():

    print("=" * 70)
    print("COMPLETE FACE AI PIPELINE TEST")
    print("=" * 70)

    # =========================================================
    # 1. Load image
    # =========================================================

    print("\n1. Loading image...")

    image = cv2.imread(str(IMAGE_PATH))

    if image is None:
        raise FileNotFoundError(
            f"Could not read image: {IMAGE_PATH}"
        )

    print(
        f"Image size: "
        f"{image.shape[1]} x {image.shape[0]}"
    )

    # =========================================================
    # 2. Load SCRFD
    # =========================================================

    print("\n2. Loading SCRFD detector...")

    detector = SCRFDDetector(
        model_path=str(SCRFD_MODEL),
        input_size=(640, 640),
        confidence_threshold=0.20,
        nms_threshold=0.40,
    )

    # =========================================================
    # 3. Detect face
    # =========================================================

    print("\n3. Detecting face...")

    detections = detector.detect(image)

    print(
        f"Detected faces: {len(detections)}"
    )

    if not detections:
        raise RuntimeError(
            "No face detected."
        )

    detection = max(
        detections,
        key=lambda item: item["score"],
    )

    print(
        f"Selected face score: "
        f"{detection['score']:.6f}"
    )

    print("\nLandmarks:")

    for index, point in enumerate(
        detection["landmarks"],
        start=1,
    ):
        print(
            f"  Point {index}: "
            f"({point[0]:.2f}, {point[1]:.2f})"
        )

    # =========================================================
    # 4. Align face
    # =========================================================

    print("\n4. Aligning face...")

    aligner = FaceAligner(
        output_size=(112, 112)
    )

    aligned_face = aligner.align_detection(
        image,
        detection,
    )

    print(
        f"Aligned face shape: "
        f"{aligned_face.shape}"
    )

    if aligned_face.shape != (112, 112, 3):
        raise RuntimeError(
            f"Unexpected aligned face shape: "
            f"{aligned_face.shape}"
        )

    # Save for visual verification
    aligned_path = (
        PROJECT_ROOT
        / "test_data"
        / "pipeline_aligned_face.jpg"
    )

    FaceAligner.save(
        aligned_face,
        aligned_path,
    )

    print(
        f"Aligned face saved to: "
        f"{aligned_path}"
    )

    # =========================================================
    # 5. Load MobileFaceNet
    # =========================================================

    print("\n5. Loading MobileFaceNet...")

    recognizer = ArcFaceRecognizer(
        model_path=str(ARCFACE_MODEL)
    )

    # =========================================================
    # 6. Generate embedding
    # =========================================================

    print("\n6. Generating face embedding...")

    embedding = recognizer.get_embedding(
        aligned_face
    )

    print(
        f"Embedding shape: "
        f"{embedding.shape}"
    )

    print(
        f"Embedding dtype: "
        f"{embedding.dtype}"
    )

    # =========================================================
    # 7. Validate embedding
    # =========================================================

    print("\n7. Validating embedding...")

    if embedding.shape != (512,):
        raise RuntimeError(
            f"Expected 512-D embedding, "
            f"got {embedding.shape}"
        )

    if embedding.dtype != np.float32:
        raise RuntimeError(
            f"Expected float32, "
            f"got {embedding.dtype}"
        )

    if not np.isfinite(embedding).all():
        raise RuntimeError(
            "Embedding contains NaN or infinity."
        )

    norm = np.linalg.norm(embedding)

    print(
        f"L2 norm: {norm:.6f}"
    )

    if abs(norm - 1.0) > 1e-5:
        raise RuntimeError(
            f"Embedding is not normalized. "
            f"Norm={norm}"
        )

    print("\n✓ Face detected")
    print("✓ Landmarks obtained")
    print("✓ Face aligned to 112×112")
    print("✓ MobileFaceNet inference successful")
    print("✓ 512-D embedding generated")
    print("✓ Embedding is normalized")

    # =========================================================
    # 8. Show part of embedding
    # =========================================================

    print("\nFirst 10 embedding values:")

    for index, value in enumerate(embedding[:10]):
        print(
            f"  [{index:02d}] {value:.6f}"
        )

    print("\n" + "=" * 70)
    print("COMPLETE FACE AI PIPELINE TEST PASSED")
    print("=" * 70)


if __name__ == "__main__":
    main()