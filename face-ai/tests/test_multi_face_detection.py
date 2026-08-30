import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2

from app.detection.scrfd_detector import SCRFDDetector

SCRFD_MODEL_PATH = PROJECT_ROOT / "models" / "scrfd" / "scrfd_500m_bnkps.onnx"
MULTI_FACE_IMAGE_PATH = (
    PROJECT_ROOT / "test_data" / "recognition" / "person2" / "person2_2.jpg"
)
ANNOTATED_OUTPUT_PATH = (
    PROJECT_ROOT / "test_data" / "recognition" / "person2" / "person2_2_multi_face.jpg"
)


def main():
    print("=" * 60)
    print("MULTI-FACE DETECTION TEST")
    print("=" * 60)

    if not MULTI_FACE_IMAGE_PATH.exists():
        raise FileNotFoundError(f"Image not found at: {MULTI_FACE_IMAGE_PATH}")

    image = cv2.imread(str(MULTI_FACE_IMAGE_PATH))
    if image is None:
        raise ValueError(f"Could not read image: {MULTI_FACE_IMAGE_PATH}")

    print(f"\nLoaded image: {MULTI_FACE_IMAGE_PATH.name}")
    print(f"Dimensions: {image.shape[1]}x{image.shape[0]}")

    detector = SCRFDDetector(
        model_path=str(SCRFD_MODEL_PATH),
        input_size=(640, 640),
        confidence_threshold=0.5,
        nms_threshold=0.4,
    )

    detections = detector.detect(image)
    print(f"\nDetected faces: {len(detections)}")

    if len(detections) < 2:
        raise RuntimeError(
            f"Expected at least 2 faces in person2_2.jpg, but detected {len(detections)}"
        )

    annotated_image = image.copy()

    for idx, face in enumerate(detections, start=1):
        score = face["score"]
        bbox = face["bbox"]
        landmarks = face["landmarks"]

        print(f"\nFace #{idx}")
        print(f"  Confidence: {score:.6f}")
        print(f"  BBox: {bbox}")
        print(f"  Landmarks: {landmarks}")

        # Draw bounding box
        x1, y1, x2, y2 = [int(v) for v in bbox]
        cv2.rectangle(annotated_image, (x1, y1), (x2, y2), (0, 255, 0), 3)

        # Draw landmarks
        for pt in landmarks:
            lx, ly = int(pt[0]), int(pt[1])
            cv2.circle(annotated_image, (lx, ly), 4, (0, 0, 255), -1)

        # Draw label
        label = f"Face #{idx} ({score:.2f})"
        cv2.putText(
            annotated_image,
            label,
            (x1, max(y1 - 10, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

    ANNOTATED_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    success = cv2.imwrite(str(ANNOTATED_OUTPUT_PATH), annotated_image)

    if not success:
        raise RuntimeError(f"Failed to save annotated image to: {ANNOTATED_OUTPUT_PATH}")

    print(f"\nSaved annotated image to: {ANNOTATED_OUTPUT_PATH}")
    print("\n" + "=" * 60)
    print("MULTI-FACE DETECTION TEST PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
