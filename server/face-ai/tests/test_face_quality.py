"""
Comprehensive test suite for FaceQualityAnalyzer.
Includes image evaluation tests, annotation saving, and negative tests.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.detection.scrfd_detector import SCRFDDetector
from app.quality.face_quality import FaceQualityAnalyzer

IMAGE_PATH = PROJECT_ROOT / "test_data" / "recognition" / "person1" / "person1_1.jpg"
SCRFD_MODEL_PATH = PROJECT_ROOT / "models" / "scrfd" / "scrfd_500m_bnkps.onnx"
QUALITY_MODEL_PATH = PROJECT_ROOT / "models" / "quality" / "face_det_lite.onnx"
OUTPUT_ANNOTATED_PATH = PROJECT_ROOT / "test_data" / "face_quality_result.jpg"


def test_positive_image_evaluation():
    print("\n--- TEST: Image Evaluation & Annotation ---")
    image = cv2.imread(str(IMAGE_PATH))
    assert image is not None, f"Could not read test image: {IMAGE_PATH}"

    detector = SCRFDDetector(
        model_path=str(SCRFD_MODEL_PATH),
        input_size=(640, 640),
        confidence_threshold=0.20,
        nms_threshold=0.40,
    )

    analyzer = FaceQualityAnalyzer(
        model_path=QUALITY_MODEL_PATH,
        quality_threshold=0.50,
        min_detection_confidence=0.40,
        use_sharpness=True,
    )

    detections = detector.detect(image)
    assert len(detections) > 0, "No faces detected in test image"

    annotated = image.copy()

    for idx, det in enumerate(detections, start=1):
        bbox = det["bbox"]
        scrfd_score = det["score"]
        landmarks = det.get("landmarks")

        res = analyzer.analyze(
            image=image,
            bbox=bbox,
            landmarks=landmarks,
            detection_confidence=scrfd_score,
        )

        print(f"Face #{idx}: SCRFD={scrfd_score:.4f}, Quality={res['quality_score']:.4f}, Decision={res['decision']}")

        # Draw annotation on output image
        x1, y1, x2, y2 = [int(round(v)) for v in bbox]
        color = (0, 255, 0) if res["usable"] else (0, 0, 255)

        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label_text = f"Face #{idx}: {res['decision']} (Q={res['quality_score']:.2f})"
        if res["reasons"]:
            label_text += f" [{','.join(res['reasons'])}]"

        cv2.putText(
            annotated,
            label_text,
            (x1, max(30, y1 - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2,
            cv2.LINE_AA,
        )

    OUTPUT_ANNOTATED_PATH.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUTPUT_ANNOTATED_PATH), annotated)
    print(f"Saved annotated result to: {OUTPUT_ANNOTATED_PATH}")
    print("PASS: Image evaluation test")


def test_negative_inputs():
    print("\n--- TEST: Negative & Invalid Inputs ---")
    analyzer = FaceQualityAnalyzer(
        model_path=QUALITY_MODEL_PATH,
        quality_threshold=0.50,
        min_face_width=32,
        min_face_height=32,
        min_face_area_ratio=0.001,
        min_detection_confidence=0.40,
        min_sharpness=50.0,
        use_sharpness=True,
    )

    valid_image = cv2.imread(str(IMAGE_PATH))
    assert valid_image is not None

    # 1. Invalid bbox (negative/zero dimensions)
    res_inv_bbox = analyzer.analyze(valid_image, [100, 100, 50, 50])
    assert not res_inv_bbox["usable"]
    assert "invalid_bbox" in res_inv_bbox["reasons"]
    print("  [OK] Passed: Invalid bbox test")

    # 2. Empty image
    res_empty_img = analyzer.analyze(np.array([], dtype=np.uint8), [10, 10, 50, 50])
    assert not res_empty_img["usable"]
    assert "empty_image" in res_empty_img["reasons"]
    print("  [OK] Passed: Empty image test")

    # 3. Face completely outside image
    res_out_bounds = analyzer.analyze(valid_image, [-200, -200, -100, -100])
    assert not res_out_bounds["usable"]
    assert "face_out_of_bounds" in res_out_bounds["reasons"]
    print("  [OK] Passed: Face outside image test")

    # 4. Too small face
    res_small_face = analyzer.analyze(valid_image, [100, 100, 110, 110])  # 10x10 < 32x32
    assert not res_small_face["usable"]
    assert "face_too_small" in res_small_face["reasons"]
    print("  [OK] Passed: Too small face test")

    # 5. Low SCRFD confidence
    res_low_conf = analyzer.analyze(
        valid_image, [100, 100, 300, 300], detection_confidence=0.15
    )
    assert not res_low_conf["usable"]
    assert "low_detection_confidence" in res_low_conf["reasons"]
    print("  [OK] Passed: Low detection confidence test")

    # 6. Invalid landmarks
    bad_landmarks = [[100, 100], [90, 100], [110, 120], [100, 140], [110, 140]]  # right eye left of left eye
    res_bad_lm = analyzer.analyze(
        valid_image, [80, 80, 200, 200], landmarks=bad_landmarks
    )
    assert not res_bad_lm["usable"]
    assert "invalid_landmarks" in res_bad_lm["reasons"]
    print("  [OK] Passed: Invalid landmarks test")

    # 7. Missing landmarks (should pass landmark check, not crash)
    res_no_lm = analyzer.analyze(
        valid_image, [100, 100, 400, 400], landmarks=None, detection_confidence=0.90
    )
    assert res_no_lm["metrics"]["landmarks_valid"] is True
    print("  [OK] Passed: Missing landmarks handled gracefully test")

    print("PASS: All negative tests passed successfully")


def main():
    print("=" * 60)
    print("RUNNING FACE QUALITY TEST SUITE")
    print("=" * 60)

    test_positive_image_evaluation()
    test_negative_inputs()

    print("\n" + "=" * 60)
    print("ALL FACE QUALITY TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
