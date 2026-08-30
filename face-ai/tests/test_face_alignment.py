import sys
from pathlib import Path

# Add face-ai project root to Python import path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import cv2

from app.detection.scrfd_detector import SCRFDDetector
from app.detection.face_alignment import FaceAligner


MODEL_PATH = Path(
    "models/scrfd/scrfd_500m_bnkps.onnx"
)

IMAGE_PATH = Path(
    "test_data/test.jpg"
)

OUTPUT_PATH = Path(
    "test_data/aligned_face.jpg"
)


def main():

    print("=" * 60)
    print("FACE ALIGNMENT TEST")
    print("=" * 60)

    # ---------------------------------------------------------
    # Load detector
    # ---------------------------------------------------------

    print("\n1. Loading SCRFD detector...")

    detector = SCRFDDetector(
        model_path=str(MODEL_PATH),
        input_size=(640, 640),
        confidence_threshold=0.20,
        nms_threshold=0.40,
    )

    # ---------------------------------------------------------
    # Load image
    # ---------------------------------------------------------

    print("\n2. Loading image...")

    image = cv2.imread(
        str(IMAGE_PATH)
    )

    if image is None:
        raise FileNotFoundError(
            f"Could not read image: {IMAGE_PATH}"
        )

    print(
        f"Original image size: "
        f"{image.shape[1]} x {image.shape[0]}"
    )

    # ---------------------------------------------------------
    # Detect faces
    # ---------------------------------------------------------

    print("\n3. Detecting faces...")

    detections = detector.detect(image)

    print(
        f"Detected faces: {len(detections)}"
    )

    if not detections:
        raise RuntimeError(
            "No face detected."
        )

    # ---------------------------------------------------------
    # Select strongest face
    # ---------------------------------------------------------

    detection = max(
        detections,
        key=lambda item: item["score"],
    )

    print(
        f"Selected face confidence: "
        f"{detection['score']:.6f}"
    )

    print("\nDetected landmarks:")

    for index, point in enumerate(
        detection["landmarks"],
        start=1,
    ):
        print(
            f"  Point {index}: "
            f"({point[0]:.2f}, {point[1]:.2f})"
        )

    # ---------------------------------------------------------
    # Create aligner
    # ---------------------------------------------------------

    print("\n4. Creating face aligner...")

    aligner = FaceAligner(
        output_size=(112, 112)
    )

    # ---------------------------------------------------------
    # Align
    # ---------------------------------------------------------

    print("\n5. Aligning face...")

    aligned_face = aligner.align_detection(
        image,
        detection,
    )

    # ---------------------------------------------------------
    # Validate result
    # ---------------------------------------------------------

    print(
        f"\nAligned image shape: "
        f"{aligned_face.shape}"
    )

    expected_shape = (
        112,
        112,
        3,
    )

    if aligned_face.shape != expected_shape:
        raise RuntimeError(
            "Unexpected aligned image shape: "
            f"{aligned_face.shape}"
        )

    # ---------------------------------------------------------
    # Save
    # ---------------------------------------------------------

    print("\n6. Saving aligned face...")

    FaceAligner.save(
        aligned_face,
        OUTPUT_PATH,
    )

    print("\n" + "=" * 60)
    print("ALIGNMENT TEST COMPLETE")
    print("=" * 60)

    print(
        f"\nAligned face saved to:"
        f"\n{OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()