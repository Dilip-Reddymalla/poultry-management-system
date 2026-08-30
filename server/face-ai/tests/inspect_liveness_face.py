"""
Liveness face inspection test.

Loads a static photograph, detects all faces with SCRFD,
and runs the corrected liveness model on each face.

Usage:
    cd face-ai
    .venv\\Scripts\\python.exe tests/inspect_liveness_face.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


# ============================================================
# Project path
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.detection.scrfd_detector import SCRFDDetector
from app.liveness.liveness import LivenessAnalyzer


# ============================================================
# Configuration
# ============================================================

MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "liveness"
    / "modelrgb.onnx"
)

IMAGE_PATH = (
    PROJECT_ROOT
    / "test_data"
    / "recognition"
    / "person1"
    / "person1_1.jpg"
)

DEBUG_DIR = (
    PROJECT_ROOT
    / "test_data"
    / "liveness_debug"
)


# ============================================================
# Main
# ============================================================

def main():

    print("=" * 60)
    print("LIVENESS FACE MODEL TEST")
    print("=" * 60)

    # --------------------------------------------------------
    # Create debug directory
    # --------------------------------------------------------

    DEBUG_DIR.mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------------
    # Load liveness model
    # --------------------------------------------------------

    print("\nLoading liveness analyzer...")

    analyzer = LivenessAnalyzer(
        model_path=MODEL_PATH,
        live_class_index=1,
        live_threshold=0.50,
    )

    info = analyzer.model_info()

    print("Model loaded successfully.")

    print("\nMODEL INFO")

    for key, value in info.items():
        print(f"  {key}: {value}")

    # --------------------------------------------------------
    # Load image
    # --------------------------------------------------------

    print("\nLoading image...")

    image = cv2.imread(
        str(IMAGE_PATH)
    )

    if image is None:
        raise FileNotFoundError(
            f"Could not read image: {IMAGE_PATH}"
        )

    print(
        "Image:",
        image.shape[1],
        "x",
        image.shape[0],
    )

    # --------------------------------------------------------
    # Load SCRFD
    # --------------------------------------------------------

    print("\nLoading SCRFD detector...")

    detector = SCRFDDetector(
        model_path=str(
            PROJECT_ROOT
            / "models"
            / "scrfd"
            / "scrfd_500m_bnkps.onnx"
        ),
        input_size=(640, 640),
        confidence_threshold=0.20,
        nms_threshold=0.40,
    )

    print("SCRFD loaded successfully.")

    # --------------------------------------------------------
    # Detect faces
    # --------------------------------------------------------

    print("\nRunning SCRFD face detection...")

    detections = detector.detect(image)

    print(
        f"Faces detected: {len(detections)}"
    )

    if not detections:
        print("\nNo faces detected.")
        return

    # --------------------------------------------------------
    # Process EVERY face
    # --------------------------------------------------------

    for index, detection in enumerate(
        detections,
        start=1,
    ):

        print("\n" + "-" * 60)
        print(f"FACE #{index}")
        print("-" * 60)

        bbox = detection["bbox"]
        score = detection["score"]

        print(
            "SCRFD confidence:",
            f"{score:.6f}",
        )

        print(
            "Bounding box:",
            [
                round(float(v), 2)
                for v in bbox
            ],
        )

        # ----------------------------------------------------
        # Full liveness analysis (crop + predict)
        # ----------------------------------------------------

        result = analyzer.analyze(
            image=image,
            bbox=bbox,
        )

        # Save the face crop used by the model.
        face_crop = analyzer.crop_face(
            image,
            bbox,
        )

        crop_path = (
            DEBUG_DIR
            / f"face_crop_{index}.jpg"
        )

        cv2.imwrite(
            str(crop_path),
            face_crop,
        )

        print(
            f"\nCrop saved: {crop_path}"
        )

        print(
            f"Crop size: "
            f"{face_crop.shape[1]}x"
            f"{face_crop.shape[0]}"
        )

        # Save resized 112x112 input.
        resized = cv2.resize(
            face_crop,
            (112, 112),
            interpolation=cv2.INTER_LINEAR,
        )

        resized_path = (
            DEBUG_DIR
            / f"resized_112x112_{index}.jpg"
        )

        cv2.imwrite(
            str(resized_path),
            resized,
        )

        # Tensor stats.
        tensor = analyzer.preprocess(
            face_crop
        )

        print("\nPREPROCESSING")
        print(f"  Shape: {tensor.shape}")
        print(f"  Dtype: {tensor.dtype}")
        print(f"  Color: BGR")
        print(
            f"  Min: {float(tensor.min()):.6f}"
        )
        print(
            f"  Max: {float(tensor.max()):.6f}"
        )
        print(
            f"  Mean: {float(tensor.mean()):.6f}"
        )

        for ch in range(3):
            ch_data = tensor[0, ch]
            print(
                f"  Ch{ch}: "
                f"mean={float(ch_data.mean()):.4f} "
                f"std={float(ch_data.std()):.4f}"
            )

        # Result.
        print("\nRESULT")
        print(
            f"  Decision: {result['decision']}"
        )
        print(
            f"  Is live:  {result['is_live']}"
        )
        print(
            f"  Score:    {result['score']:.6f}"
        )
        print(
            f"  Class 0 (SPOOF): "
            f"{result['scores']['class_0']:.6f}"
        )
        print(
            f"  Class 1 (LIVE):  "
            f"{result['scores']['class_1']:.6f}"
        )
        print(
            f"  Raw output: {result['raw_output']}"
        )

        total = (
            result['scores']['class_0']
            + result['scores']['class_1']
        )

        print(f"  Score sum: {total:.6f}")

        if abs(total - 1.0) < 0.05:
            print(
                "  Output: softmax probabilities"
            )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print("\n" + "=" * 60)
    print("EXPECTED BEHAVIOR")
    print("=" * 60)

    print(
        "\nThis is a STATIC PHOTOGRAPH."
    )
    print(
        "All faces should be classified "
        "as SPOOF."
    )

    print(
        "\nCorrect result:"
    )
    print(
        "  Class 0 (SPOOF) should be HIGH"
    )
    print(
        "  Class 1 (LIVE) should be LOW"
    )
    print(
        "  Decision should be SPOOF"
    )

    # --------------------------------------------------------
    # Complete
    # --------------------------------------------------------

    print("\n" + "=" * 60)
    print("LIVENESS FACE TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
