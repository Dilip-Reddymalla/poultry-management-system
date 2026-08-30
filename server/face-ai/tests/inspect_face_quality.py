"""
Dedicated face quality inspection test for evaluating faces on a static image.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.detection.scrfd_detector import SCRFDDetector
from app.quality.face_quality import FaceQualityAnalyzer

IMAGE_PATH = PROJECT_ROOT / "test_data" / "recognition" / "person1" / "person1_1.jpg"
SCRFD_MODEL_PATH = PROJECT_ROOT / "models" / "scrfd" / "scrfd_500m_bnkps.onnx"
QUALITY_MODEL_PATH = PROJECT_ROOT / "models" / "quality" / "face_det_lite.onnx"


def main():
    print("=" * 60)
    print("FACE QUALITY INSPECTION")
    print("=" * 60)

    print(f"\nImage: {IMAGE_PATH}")
    image = cv2.imread(str(IMAGE_PATH))

    if image is None:
        print("ERROR: Image could not be read.")
        return

    print(f"Image size: {image.shape[1]} x {image.shape[0]}")

    print("\nLoading SCRFD detector...")
    detector = SCRFDDetector(
        model_path=str(SCRFD_MODEL_PATH),
        input_size=(640, 640),
        confidence_threshold=0.20,
        nms_threshold=0.40,
    )

    print("Loading FaceQualityAnalyzer...")
    analyzer = FaceQualityAnalyzer(
        model_path=QUALITY_MODEL_PATH,
        quality_threshold=0.50,
        min_detection_confidence=0.40,
        use_sharpness=True,
    )

    info = analyzer.model_info()
    print("\nMODEL INFO:")
    for k, v in info.items():
        print(f"  {k}: {v}")

    print("\nRunning SCRFD face detection...")
    detections = detector.detect(image)
    print(f"Faces detected: {len(detections)}")

    for idx, det in enumerate(detections, start=1):
        print("\n" + "-" * 60)
        print(f"FACE #{idx}")
        print("-" * 60)

        bbox = det["bbox"]
        scrfd_score = det["score"]
        landmarks = det.get("landmarks")

        print(f"SCRFD confidence: {scrfd_score:.6f}")
        print(f"Bounding box: {[round(float(v), 2) for v in bbox]}")

        res = analyzer.analyze(
            image=image,
            bbox=bbox,
            landmarks=landmarks,
            detection_confidence=scrfd_score,
        )

        metrics = res["metrics"]
        print(f"\nFace size:")
        print(f"  Width:  {metrics['face_width']}")
        print(f"  Height: {metrics['face_height']}")
        print(f"  Area:   {metrics['face_area']:.1f}")
        print(f"  Relative area: {metrics['relative_area']:.6f}")

        if landmarks is not None:
            print("\nLandmarks:")
            pt_names = ["Left eye", "Right eye", "Nose", "Left mouth", "Right mouth"]
            pts = list(landmarks)
            for i, name in enumerate(pt_names):
                print(f"  {name}: ({pts[i][0]:.1f}, {pts[i][1]:.1f})")

        print(f"\nLandmarks valid: {'YES' if metrics['landmarks_valid'] else 'NO'}")
        if metrics['sharpness'] is not None:
            print(f"Sharpness: {metrics['sharpness']:.2f}")

        model_res = res["model"]
        print(f"\nLight-FaceQ:")
        print(f"  Quality score: {model_res['score']:.6f}")
        if "details" in model_res and model_res["details"]:
            det_info = model_res["details"]
            print(f"  Heatmap raw min:  {det_info['raw_heatmap_min']:.4f}")
            print(f"  Heatmap raw max:  {det_info['raw_heatmap_max']:.4f}")
            print(f"  Heatmap raw mean: {det_info['raw_heatmap_mean']:.4f}")

        print(f"\nFINAL:")
        print(f"  Decision: {res['decision']}")
        print(f"  Usable:   {res['usable']}")
        if res["reasons"]:
            print(f"  Reasons:  {res['reasons']}")

    print("\n" + "=" * 60)
    print("FACE QUALITY INSPECTION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
