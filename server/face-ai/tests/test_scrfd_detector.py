import sys
from pathlib import Path

# Add face-ai project root to Python import path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import cv2

from app.detection.scrfd_detector import SCRFDDetector


MODEL_PATH = Path(
    "models/scrfd/scrfd_500m_bnkps.onnx"
)

IMAGE_PATH = Path(
    "test_data/test.jpg"
)

OUTPUT_PATH = Path(
    "test_data/detection_result.jpg"
)


def main():
    print("=" * 60)
    print("SCRFD COMPLETE DETECTION TEST")
    print("=" * 60)

    # ---------------------------------------------------------
    # Load detector
    # ---------------------------------------------------------

    print("\n1. Loading detector...")

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

    image = cv2.imread(str(IMAGE_PATH))

    if image is None:
        raise FileNotFoundError(
            f"Could not read image: {IMAGE_PATH}"
        )

    print(
        f"Image size: "
        f"{image.shape[1]} x {image.shape[0]}"
    )

    # ---------------------------------------------------------
    # Detect
    # ---------------------------------------------------------

    print("\n3. Running face detection...")

    detections = detector.detect(image)

    print(
        f"\nNumber of final detections: "
        f"{len(detections)}"
    )

    # ---------------------------------------------------------
    # Display detection results
    # ---------------------------------------------------------

    for i, detection in enumerate(detections):

        print("\n" + "-" * 50)

        print(f"Face #{i + 1}")

        print(
            "Confidence:",
            f"{detection['score']:.6f}"
        )

        print(
            "Bounding box:",
            [
                round(value, 2)
                for value in detection["bbox"]
            ],
        )

        print("Landmarks:")

        for j, point in enumerate(
            detection["landmarks"],
            start=1,
        ):
            print(
                f"  Point {j}: "
                f"({point[0]:.2f}, {point[1]:.2f})"
            )

    # ---------------------------------------------------------
    # Draw results
    # ---------------------------------------------------------

    result = image.copy()

    for i, detection in enumerate(detections):

        bbox = detection["bbox"]

        x1, y1, x2, y2 = [
            int(round(value))
            for value in bbox
        ]

        score = detection["score"]

        # Bounding box
        cv2.rectangle(
            result,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2,
        )

        # Label
        label = (
            f"Face {i + 1}: "
            f"{score:.2f}"
        )

        cv2.putText(
            result,
            label,
            (x1, max(20, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

        # Landmarks
        for point in detection["landmarks"]:

            x = int(round(point[0]))
            y = int(round(point[1]))

            cv2.circle(
                result,
                (x, y),
                4,
                (0, 0, 255),
                -1,
            )

    # ---------------------------------------------------------
    # Save result
    # ---------------------------------------------------------

    success = cv2.imwrite(
        str(OUTPUT_PATH),
        result,
    )

    if not success:
        raise RuntimeError(
            f"Failed to save result: {OUTPUT_PATH}"
        )

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

    print(
        f"\nResult image saved to:"
        f"\n{OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()