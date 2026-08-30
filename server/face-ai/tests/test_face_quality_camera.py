"""
Live camera test for multi-face Quality evaluation.
Evaluates EVERY detected face independently using FaceQualityAnalyzer.

Usage:
    cd face-ai
    .venv\\Scripts\\python.exe tests/test_face_quality_camera.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.detection.scrfd_detector import SCRFDDetector
from app.quality.face_quality import FaceQualityAnalyzer

SCRFD_MODEL_PATH = PROJECT_ROOT / "models" / "scrfd" / "scrfd_500m_bnkps.onnx"
QUALITY_MODEL_PATH = PROJECT_ROOT / "models" / "quality" / "face_det_lite.onnx"

CAMERA_INDEX = 0


def draw_quality_box(
    frame: np.ndarray,
    detection: dict,
    index: int,
    result: dict,
):
    x1, y1, x2, y2 = [int(round(v)) for v in detection["bbox"]]
    scrfd_score = float(detection["score"])

    usable = result["usable"]
    decision = result["decision"]
    quality_score = result["quality_score"]
    reasons = result["reasons"]

    color = (0, 255, 0) if usable else (0, 0, 255)

    label = f"Face #{index} | {decision} (Q:{quality_score:.2f})"
    scrfd_text = f"SCRFD: {scrfd_score:.2f}"
    
    reason_text = ""
    if reasons:
        reason_text = f"Reason: {reasons[0]}"

    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    text_y = max(25, y1 - 45)
    box_height = 55 if reasons else 38

    cv2.rectangle(
        frame,
        (x1, text_y - 18),
        (max(x2, x1 + 240), y1),
        (0, 0, 0),
        -1,
    )

    cv2.putText(
        frame,
        label,
        (x1 + 5, text_y - 2),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        color,
        2,
        cv2.LINE_AA,
    )

    cv2.putText(
        frame,
        scrfd_text,
        (x1 + 5, text_y + 15),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (255, 255, 255),
        1,
        cv2.LINE_AA,
    )

    if reason_text:
        cv2.putText(
            frame,
            reason_text,
            (x1 + 5, text_y + 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (0, 165, 255),
            1,
            cv2.LINE_AA,
        )


def main():
    print("=" * 60)
    print("LIVE MULTI-FACE QUALITY CAMERA TEST")
    print("=" * 60)

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
        quality_threshold=0.35,
        min_detection_confidence=0.30,
        min_sharpness=15.0,
        use_sharpness=True,
    )

    print(f"\nOpening camera {CAMERA_INDEX}...")
    camera = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
    if not camera.isOpened():
        camera.release()
        camera = cv2.VideoCapture(CAMERA_INDEX)

    if not camera.isOpened():
        raise RuntimeError(f"Could not open camera index {CAMERA_INDEX}")

    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    actual_w = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Camera opened. Resolution: {actual_w} x {actual_h}")

    print("\nPress Q or ESC to quit camera test.")
    print("Press S to save current frame annotation.")

    frame_count = 0
    fps_start = time.time()
    fps = 0.0
    last_print_time = 0.0

    try:
        while True:
            ret, frame = camera.read()
            if not ret:
                print("Failed to capture frame.")
                break

            frame_count += 1
            detections = detector.detect(frame)
            display = frame.copy()
            face_results = []

            for index, det in enumerate(detections, start=1):
                try:
                    bbox = det["bbox"]
                    scrfd_score = det["score"]
                    landmarks = det.get("landmarks")

                    res = analyzer.analyze(
                        image=frame,
                        bbox=bbox,
                        landmarks=landmarks,
                        detection_confidence=scrfd_score,
                    )

                    face_results.append((index, det, res))
                    draw_quality_box(display, det, index, res)

                except Exception as exc:
                    print(f"Face {index} evaluation error: {exc}")

            elapsed = time.time() - fps_start
            if elapsed >= 1.0:
                fps = frame_count / elapsed
                frame_count = 0
                fps_start = time.time()

            cv2.putText(
                display,
                f"FPS: {fps:.1f} | Detected Faces: {len(detections)}",
                (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (0, 255, 255),
                2,
                cv2.LINE_AA,
            )

            cv2.imshow("Multi-Face Quality Inspection", display)

            now = time.time()
            if now - last_print_time >= 1.0:
                last_print_time = now
                if detections:
                    print(f"\nFrame | Faces: {len(detections)}")
                    for index, det, res in face_results:
                        reasons_str = f" Rejection: {res['reasons']}" if res['reasons'] else ""
                        print(
                            f"  Face #{index} | SCRFD: {det['score']:.3f} | "
                            f"Quality: {res['quality_score']:.4f} | "
                            f"Decision: {res['decision']}{reasons_str}"
                        )

            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), ord("Q"), 27):
                break

            if key in (ord("s"), ord("S")):
                save_path = PROJECT_ROOT / "test_data" / "camera_quality_snapshot.jpg"
                cv2.imwrite(str(save_path), display)
                print(f"Saved snapshot to: {save_path}")

    finally:
        camera.release()
        cv2.destroyAllWindows()

    print("\n" + "=" * 60)
    print("QUALITY CAMERA TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
