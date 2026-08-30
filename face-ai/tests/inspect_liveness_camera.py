from __future__ import annotations

import sys
import time
from pathlib import Path

import cv2
import numpy as np


# ============================================================
# Project root
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.detection.scrfd_detector import SCRFDDetector
from app.liveness.liveness import LivenessAnalyzer


# ============================================================
# Configuration
# ============================================================

LIVENESS_MODEL_PATH = PROJECT_ROOT / "models" / "liveness" / "modelrgb.onnx"
SCRFD_MODEL_PATH = PROJECT_ROOT / "models" / "scrfd" / "scrfd_500m_bnkps.onnx"

CAMERA_INDEX = 0

SCRFD_CONFIDENCE = 0.20
SCRFD_NMS = 0.40


# ============================================================
# Draw face
# ============================================================

def draw_face(
    frame: np.ndarray,
    detection: dict,
    index: int,
    result: dict,
):
    x1, y1, x2, y2 = [int(round(v)) for v in detection["bbox"]]
    scrfd_score = float(detection["score"])

    decision = result["decision"]
    score = result["score"]
    c0 = result["scores"]["class_0"]
    c1 = result["scores"]["class_1"]

    color = (0, 255, 0) if decision == "LIVE" else (0, 0, 255)

    label = f"Face {index} | {decision} ({score:.2f})"
    scores_text = f"C0(Spoof):{c0:.3f} C1(Live):{c1:.3f}"
    detection_text = f"SCRFD:{scrfd_score:.3f}"

    # Bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    # Background area for text
    text_y = max(25, y1 - 55)

    cv2.rectangle(
        frame,
        (x1, text_y - 20),
        (max(x2, x1 + 260), y1),
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
        scores_text,
        (x1 + 5, text_y + 17),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.48,
        (255, 255, 255),
        1,
        cv2.LINE_AA,
    )

    cv2.putText(
        frame,
        detection_text,
        (x1 + 5, text_y + 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.48,
        (255, 255, 255),
        1,
        cv2.LINE_AA,
    )


# ============================================================
# Main
# ============================================================

def main():
    print("=" * 60)
    print("RAW CAMERA LIVENESS INSPECTION (UPDATED)")
    print("=" * 60)

    # --------------------------------------------------------
    # Load liveness model
    # --------------------------------------------------------
    print("\nLoading liveness analyzer...")

    analyzer = LivenessAnalyzer(
        model_path=LIVENESS_MODEL_PATH,
        live_class_index=1,
        live_threshold=0.50,
    )

    print("Liveness analyzer loaded.")
    info = analyzer.model_info()
    for k, v in info.items():
        print(f"  {k}: {v}")

    # --------------------------------------------------------
    # Load SCRFD
    # --------------------------------------------------------
    print("\nLoading SCRFD detector...")

    detector = SCRFDDetector(
        model_path=str(SCRFD_MODEL_PATH),
        input_size=(640, 640),
        confidence_threshold=SCRFD_CONFIDENCE,
        nms_threshold=SCRFD_NMS,
    )

    print("SCRFD loaded successfully.")

    # --------------------------------------------------------
    # Open camera
    # --------------------------------------------------------
    print(f"\nOpening camera {CAMERA_INDEX}...")

    camera = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)

    if not camera.isOpened():
        camera.release()
        camera = cv2.VideoCapture(CAMERA_INDEX)

    if not camera.isOpened():
        raise RuntimeError(f"Could not open camera {CAMERA_INDEX}")

    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    actual_width = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_height = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"Camera opened. Resolution: {actual_width} x {actual_height}")

    print("\n" + "=" * 60)
    print("CAMERA TEST STARTED")
    print("=" * 60)
    print("Look directly at the camera.")
    print("Press Q or ESC to quit.")
    print("Press S to save current face crops.")

    frame_count = 0
    fps_start = time.time()
    fps = 0.0
    last_print_time = 0.0

    try:
        while True:
            ret, frame = camera.read()
            if not ret:
                print("Failed to read camera frame.")
                break

            frame_count += 1

            # Detect faces
            detections = detector.detect(frame)
            display = frame.copy()
            face_results = []

            for index, detection in enumerate(detections, start=1):
                try:
                    bbox = detection["bbox"]

                    # Analyze liveness
                    result = analyzer.analyze(frame, bbox)

                    face_results.append((index, detection, result))

                    draw_face(display, detection, index, result)

                except Exception as exc:
                    print(f"Face {index} error: {exc}")

            # FPS calculation
            elapsed = time.time() - fps_start
            if elapsed >= 1.0:
                fps = frame_count / elapsed
                frame_count = 0
                fps_start = time.time()

            cv2.putText(
                display,
                f"FPS: {fps:.1f} | Faces: {len(detections)}",
                (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (0, 255, 255),
                2,
                cv2.LINE_AA,
            )

            cv2.imshow("Liveness Camera Inspection", display)

            # Console output
            now = time.time()
            if now - last_print_time >= 1.0:
                last_print_time = now
                if detections:
                    print(f"\nFrame | Faces: {len(detections)}")
                    for index, det, res in face_results:
                        c0 = res["scores"]["class_0"]
                        c1 = res["scores"]["class_1"]
                        print(
                            f"  Face {index} | "
                            f"SCRFD: {det['score']:.3f} | "
                            f"Decision: {res['decision']} | "
                            f"C0(Spoof): {c0:.4f} | "
                            f"C1(Live): {c1:.4f}"
                        )

            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), ord("Q"), 27):
                break

            if key in (ord("s"), ord("S")):
                for index, det, res in face_results:
                    crop = analyzer.crop_face(frame, det["bbox"])
                    save_path = PROJECT_ROOT / "test_data" / f"camera_crop_{index}_{res['decision']}.jpg"
                    cv2.imwrite(str(save_path), crop)
                    print(f"Saved: {save_path}")

    finally:
        camera.release()
        cv2.destroyAllWindows()

    print("\n" + "=" * 60)
    print("CAMERA INSPECTION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
