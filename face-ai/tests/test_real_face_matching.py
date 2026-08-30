import sys
from pathlib import Path

# 1. Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np

from app.detection.scrfd_detector import SCRFDDetector
from app.detection.face_alignment import FaceAligner
from app.recognition.arcface import ArcFaceRecognizer
from app.matching.face_matcher import FaceMatcher


SCRFD_MODEL_PATH = PROJECT_ROOT / "models" / "scrfd" / "scrfd_500m_bnkps.onnx"
ARCFACE_MODEL_PATH = (
    PROJECT_ROOT / "models" / "arcface" / "buffalo_s" / "w600k_mbf.onnx"
)
TEST_IMAGE_PATH = PROJECT_ROOT / "test_data" / "test.jpg"


def main():
    print("=" * 60)
    print("REAL FACE MATCHING TEST")
    print("=" * 60)

    # 2. Load test image
    print("\nLoading test image...")
    if not TEST_IMAGE_PATH.exists():
        raise FileNotFoundError(f"Test image not found at: {TEST_IMAGE_PATH}")

    image = cv2.imread(str(TEST_IMAGE_PATH))
    if image is None:
        raise ValueError(f"Failed to read image from: {TEST_IMAGE_PATH}")

    print(f"Loaded image shape: {image.shape}")

    # 3. Run SCRFD detection
    print("\nInitializing detector and running detection...")
    detector = SCRFDDetector(
        model_path=str(SCRFD_MODEL_PATH),
        input_size=(640, 640),
        confidence_threshold=0.5,
        nms_threshold=0.4,
    )

    detections = detector.detect(image)
    print(f"Detected {len(detections)} face(s)")

    if not detections:
        raise RuntimeError("No faces were detected in the test image.")

    # 4. Select the strongest detected face
    strongest_face = max(detections, key=lambda d: d["score"])
    print(f"Selected strongest face score: {strongest_face['score']:.6f}")

    # 5. Generate aligned 112x112 face
    print("\nAligning face to 112x112...")
    aligner = FaceAligner(output_size=(112, 112))
    aligned_face = aligner.align_detection(image, strongest_face)

    if aligned_face is None or aligned_face.shape != (112, 112, 3):
        raise RuntimeError(
            f"Aligned face image invalid. Expected shape (112, 112, 3), got: "
            f"{None if aligned_face is None else aligned_face.shape}"
        )

    # 6 & 7. Generate two embeddings from the same aligned face
    print("\nGenerating embeddings using ArcFaceRecognizer...")
    recognizer = ArcFaceRecognizer(model_path=str(ARCFACE_MODEL_PATH))

    embedding1 = recognizer.get_embedding(aligned_face)
    embedding2 = recognizer.get_embedding(aligned_face)

    norm1 = np.linalg.norm(embedding1)
    norm2 = np.linalg.norm(embedding2)

    # 8. Use FaceMatcher to compare embeddings
    matcher = FaceMatcher(threshold=0.40)
    match_result = matcher.compare(embedding1, embedding2)

    similarity = match_result["similarity"]
    threshold = match_result["threshold"]
    matched = match_result["matched"]

    # 9. Print outputs
    print("\n--- Embeddings & Matching Output ---")
    print(f"Embedding 1 Shape : {embedding1.shape}")
    print(f"Embedding 2 Shape : {embedding2.shape}")
    print(f"Embedding 1 L2 Norm: {norm1:.6f}")
    print(f"Embedding 2 L2 Norm: {norm2:.6f}")
    print(f"Cosine Similarity : {similarity:.6f}")
    print(f"Matching Threshold: {threshold:.6f}")
    print(f"Match Result      : {matched}")

    # 10. Verify requirements
    print("\nVerifying results...")

    if embedding1.shape != (512,):
        raise ValueError(
            f"Embedding 1 shape invalid. Expected (512,), got {embedding1.shape}"
        )

    if embedding2.shape != (512,):
        raise ValueError(
            f"Embedding 2 shape invalid. Expected (512,), got {embedding2.shape}"
        )

    if not np.isfinite(embedding1).all():
        raise ValueError("Embedding 1 contains non-finite (NaN or Inf) values.")

    if not np.isfinite(embedding2).all():
        raise ValueError("Embedding 2 contains non-finite (NaN or Inf) values.")

    if not np.isclose(norm1, 1.0, atol=1e-3):
        raise ValueError(f"Embedding 1 L2 norm ({norm1:.6f}) is not approximately 1.0.")

    if not np.isclose(norm2, 1.0, atol=1e-3):
        raise ValueError(f"Embedding 2 L2 norm ({norm2:.6f}) is not approximately 1.0.")

    if similarity < 0.999:
        raise ValueError(
            f"Same-image similarity ({similarity:.6f}) is not extremely close to 1.0."
        )

    if not matched:
        raise ValueError(
            f"Matcher failed to match same-image embeddings. Result: {matched}"
        )

    print("All verification checks passed successfully.")

    # 11. Print final success message
    print("\n" + "=" * 60)
    print("REAL FACE MATCHING TEST PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
