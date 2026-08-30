"""
Liveness Preprocessing Diagnostic Test Matrix.

Tests multiple preprocessing variants against known images
to determine the correct preprocessing for modelrgb.onnx.

Ground truth assumptions:
    - Static photograph → SPOOF
    - Real webcam face → LIVE

Usage:
    cd face-ai
    python tests/test_liveness_preprocessing.py
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


# ============================================================
# Configuration
# ============================================================

MODEL_PATH = PROJECT_ROOT / "models" / "liveness" / "modelrgb.onnx"

IMAGE_PATH = (
    PROJECT_ROOT
    / "test_data"
    / "recognition"
    / "person1"
    / "person1_1.jpg"
)

DEBUG_DIR = PROJECT_ROOT / "test_data" / "liveness_debug"

INPUT_SIZE = (112, 112)

SCRFD_MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "scrfd"
    / "scrfd_500m_bnkps.onnx"
)


# ============================================================
# Crop functions
# ============================================================

def crop_face_scaled(
    image: np.ndarray,
    bbox: list[float],
    scale: float,
) -> np.ndarray:
    """
    Create a SQUARE enlarged face crop around the
    SCRFD bounding box.

    The crop is made square by taking the larger
    of width/height, then applying the scale factor.
    """

    x1, y1, x2, y2 = map(float, bbox)

    width = x2 - x1
    height = y2 - y1

    if width <= 0 or height <= 0:
        raise ValueError(
            f"Invalid bounding box: {bbox}"
        )

    center_x = (x1 + x2) / 2.0
    center_y = (y1 + y2) / 2.0

    # Make SQUARE based on larger dimension.
    side = max(width, height)

    crop_side = side * scale

    crop_x1 = int(
        round(center_x - crop_side / 2.0)
    )
    crop_y1 = int(
        round(center_y - crop_side / 2.0)
    )
    crop_x2 = int(
        round(center_x + crop_side / 2.0)
    )
    crop_y2 = int(
        round(center_y + crop_side / 2.0)
    )

    img_h, img_w = image.shape[:2]

    crop_x1 = max(0, crop_x1)
    crop_y1 = max(0, crop_y1)
    crop_x2 = min(img_w, crop_x2)
    crop_y2 = min(img_h, crop_y2)

    if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
        raise ValueError(
            "Generated face crop is invalid."
        )

    crop = image[
        crop_y1:crop_y2,
        crop_x1:crop_x2,
    ]

    if crop.size == 0:
        raise ValueError(
            "Generated face crop is empty."
        )

    return crop


# ============================================================
# Preprocessing variants
# ============================================================

# --- OpenVINO anti-spoof-mn3 mean/scale (BGR order) ---
OPENVINO_MEAN_BGR = np.array(
    [107.8395, 119.5950, 151.2405],
    dtype=np.float32,
)

OPENVINO_SCALE_BGR = np.array(
    [55.0035, 56.4570, 63.0105],
    dtype=np.float32,
)

# --- ImageNet mean/std (RGB order) ---
IMAGENET_MEAN_RGB = np.array(
    [0.485, 0.456, 0.406],
    dtype=np.float32,
)

IMAGENET_STD_RGB = np.array(
    [0.229, 0.224, 0.225],
    dtype=np.float32,
)


def preprocess_variant_a(
    face_crop: np.ndarray,
) -> np.ndarray:
    """
    Variant A:
        BGR + 2.7x crop + OpenVINO mean/scale

    Keep BGR (no color conversion).
    Normalize: (pixel - mean) / scale
    """

    # OpenCV images are already BGR.
    resized = cv2.resize(
        face_crop,
        INPUT_SIZE,
        interpolation=cv2.INTER_LINEAR,
    )

    tensor = resized.astype(np.float32)

    # Per-channel normalization (BGR order).
    tensor = (
        (tensor - OPENVINO_MEAN_BGR)
        / OPENVINO_SCALE_BGR
    )

    tensor = np.transpose(tensor, (2, 0, 1))
    tensor = np.expand_dims(tensor, axis=0)

    return tensor.astype(np.float32)


def preprocess_variant_b(
    face_crop: np.ndarray,
) -> np.ndarray:
    """
    Variant B:
        RGB + 2.7x crop + ImageNet mean/std

    Convert BGR -> RGB.
    Normalize: /255 then (x - mean) / std
    """

    rgb = cv2.cvtColor(
        face_crop,
        cv2.COLOR_BGR2RGB,
    )

    resized = cv2.resize(
        rgb,
        INPUT_SIZE,
        interpolation=cv2.INTER_LINEAR,
    )

    tensor = resized.astype(np.float32) / 255.0

    # ImageNet normalization (RGB order).
    tensor = (
        (tensor - IMAGENET_MEAN_RGB)
        / IMAGENET_STD_RGB
    )

    tensor = np.transpose(tensor, (2, 0, 1))
    tensor = np.expand_dims(tensor, axis=0)

    return tensor.astype(np.float32)


def preprocess_variant_c(
    face_crop: np.ndarray,
) -> np.ndarray:
    """
    Variant C:
        BGR + /255.0 (baseline, no mean/std)
    """

    resized = cv2.resize(
        face_crop,
        INPUT_SIZE,
        interpolation=cv2.INTER_LINEAR,
    )

    tensor = resized.astype(np.float32) / 255.0

    tensor = np.transpose(tensor, (2, 0, 1))
    tensor = np.expand_dims(tensor, axis=0)

    return tensor.astype(np.float32)


def preprocess_variant_d(
    face_crop: np.ndarray,
) -> np.ndarray:
    """
    Variant D:
        RGB + /255.0 (current implementation, just
        with corrected crop)
    """

    rgb = cv2.cvtColor(
        face_crop,
        cv2.COLOR_BGR2RGB,
    )

    resized = cv2.resize(
        rgb,
        INPUT_SIZE,
        interpolation=cv2.INTER_LINEAR,
    )

    tensor = resized.astype(np.float32) / 255.0

    tensor = np.transpose(tensor, (2, 0, 1))
    tensor = np.expand_dims(tensor, axis=0)

    return tensor.astype(np.float32)


def preprocess_variant_g(
    face_crop: np.ndarray,
) -> np.ndarray:
    """
    Variant G:
        BGR + (pixel - 127.5) / 128.0
        Same normalization as SCRFD uses.
    """

    resized = cv2.resize(
        face_crop,
        INPUT_SIZE,
        interpolation=cv2.INTER_LINEAR,
    )

    tensor = resized.astype(np.float32)
    tensor = (tensor - 127.5) / 128.0

    tensor = np.transpose(tensor, (2, 0, 1))
    tensor = np.expand_dims(tensor, axis=0)

    return tensor.astype(np.float32)


def preprocess_variant_h(
    face_crop: np.ndarray,
) -> np.ndarray:
    """
    Variant H:
        RGB + (pixel - 127.5) / 128.0
    """

    rgb = cv2.cvtColor(
        face_crop,
        cv2.COLOR_BGR2RGB,
    )

    resized = cv2.resize(
        rgb,
        INPUT_SIZE,
        interpolation=cv2.INTER_LINEAR,
    )

    tensor = resized.astype(np.float32)
    tensor = (tensor - 127.5) / 128.0

    tensor = np.transpose(tensor, (2, 0, 1))
    tensor = np.expand_dims(tensor, axis=0)

    return tensor.astype(np.float32)


# ============================================================
# Variant registry
# ============================================================

VARIANTS = [
    {
        "name": "A",
        "desc": "BGR + 2.7x + OpenVINO mean/scale",
        "crop_scale": 2.7,
        "preprocess": preprocess_variant_a,
    },
    {
        "name": "B",
        "desc": "RGB + 2.7x + ImageNet mean/std",
        "crop_scale": 2.7,
        "preprocess": preprocess_variant_b,
    },
    {
        "name": "C",
        "desc": "BGR + 2.7x + /255 (no mean/std)",
        "crop_scale": 2.7,
        "preprocess": preprocess_variant_c,
    },
    {
        "name": "D",
        "desc": "RGB + 2.7x + /255 (current-ish)",
        "crop_scale": 2.7,
        "preprocess": preprocess_variant_d,
    },
    {
        "name": "E",
        "desc": "BGR + 1.5x + OpenVINO mean/scale",
        "crop_scale": 1.5,
        "preprocess": preprocess_variant_a,
    },
    {
        "name": "F",
        "desc": "RGB + 1.5x + ImageNet mean/std",
        "crop_scale": 1.5,
        "preprocess": preprocess_variant_b,
    },
    {
        "name": "G",
        "desc": "BGR + 2.7x + (x-127.5)/128",
        "crop_scale": 2.7,
        "preprocess": preprocess_variant_g,
    },
    {
        "name": "H",
        "desc": "RGB + 2.7x + (x-127.5)/128",
        "crop_scale": 2.7,
        "preprocess": preprocess_variant_h,
    },
    {
        "name": "I",
        "desc": "RGB + 4.0x + /255 (CURRENT BUG)",
        "crop_scale": 4.0,
        "preprocess": preprocess_variant_d,
    },
]


# ============================================================
# Tensor stats
# ============================================================

def print_tensor_stats(
    name: str,
    tensor: np.ndarray,
) -> None:

    print(f"  Shape: {tensor.shape}")
    print(f"  Dtype: {tensor.dtype}")
    print(f"  Min:   {float(tensor.min()):.6f}")
    print(f"  Max:   {float(tensor.max()):.6f}")
    print(f"  Mean:  {float(tensor.mean()):.6f}")

    # Per-channel stats (NCHW format).
    for ch in range(tensor.shape[1]):
        ch_data = tensor[0, ch]
        print(
            f"  Ch{ch}: "
            f"mean={float(ch_data.mean()):.4f} "
            f"std={float(ch_data.std()):.4f} "
            f"min={float(ch_data.min()):.4f} "
            f"max={float(ch_data.max()):.4f}"
        )


# ============================================================
# Main
# ============================================================

def main():

    print("=" * 70)
    print("LIVENESS PREPROCESSING DIAGNOSTIC TEST MATRIX")
    print("=" * 70)

    # --------------------------------------------------------
    # Create debug directory
    # --------------------------------------------------------

    DEBUG_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\nDebug output: {DEBUG_DIR}")

    # --------------------------------------------------------
    # Load liveness model
    # --------------------------------------------------------

    print("\nLoading liveness model...")

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}"
        )

    session = ort.InferenceSession(
        str(MODEL_PATH),
        providers=["CPUExecutionProvider"],
    )

    input_info = session.get_inputs()[0]
    output_info = session.get_outputs()[0]

    print(f"Model: {MODEL_PATH.name}")
    print(
        f"Input: {input_info.name} "
        f"{input_info.shape}"
    )
    print(
        f"Output: {output_info.name} "
        f"{output_info.shape}"
    )

    # --------------------------------------------------------
    # Load SCRFD
    # --------------------------------------------------------

    print("\nLoading SCRFD detector...")

    detector = SCRFDDetector(
        model_path=str(SCRFD_MODEL_PATH),
        input_size=(640, 640),
        confidence_threshold=0.20,
        nms_threshold=0.40,
    )

    # --------------------------------------------------------
    # Load test image
    # --------------------------------------------------------

    print(f"\nLoading test image: {IMAGE_PATH}")

    image = cv2.imread(str(IMAGE_PATH))

    if image is None:
        raise FileNotFoundError(
            f"Image not found: {IMAGE_PATH}"
        )

    print(
        f"Image size: "
        f"{image.shape[1]} x {image.shape[0]}"
    )

    # --------------------------------------------------------
    # Detect faces
    # --------------------------------------------------------

    print("\nRunning SCRFD face detection...")

    detections = detector.detect(image)

    print(f"Faces detected: {len(detections)}")

    if not detections:
        print("No faces detected. Exiting.")
        return

    # Use the HIGHEST confidence face for the
    # diagnostic comparison.
    detection = detections[0]
    bbox = detection["bbox"]
    score = detection["score"]

    print(
        f"\nUsing Face #1: "
        f"score={score:.4f} "
        f"bbox={[round(v, 1) for v in bbox]}"
    )

    # --------------------------------------------------------
    # Test each variant
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("PREPROCESSING VARIANT RESULTS")
    print("=" * 70)

    print(
        "\nGround truth: "
        "static photo -> should be SPOOF"
    )

    print(
        "\nExpected correct behavior:\n"
        "  If Class 0 = Real:  "
        "Class 0 should be LOW\n"
        "  If Class 0 = Spoof: "
        "Class 0 should be HIGH"
    )

    results = []

    for variant in VARIANTS:

        name = variant["name"]
        desc = variant["desc"]
        crop_scale = variant["crop_scale"]
        preprocess_fn = variant["preprocess"]

        print(f"\n--- Variant {name}: {desc} ---")

        try:

            # Crop face.
            face_crop = crop_face_scaled(
                image,
                bbox,
                scale=crop_scale,
            )

            print(
                f"  Crop: "
                f"{face_crop.shape[1]}x"
                f"{face_crop.shape[0]} "
                f"(scale={crop_scale})"
            )

            # Save crop for first variant per scale.
            crop_path = (
                DEBUG_DIR
                / f"crop_{name}_{crop_scale}x.jpg"
            )
            cv2.imwrite(
                str(crop_path),
                face_crop,
            )

            # Preprocess.
            tensor = preprocess_fn(face_crop)

            print_tensor_stats(name, tensor)

            # Save resized input visualization.
            # Reconstruct from tensor for debugging.
            vis = tensor[0].transpose(1, 2, 0)
            vis_norm = (
                (vis - vis.min())
                / (vis.max() - vis.min() + 1e-8)
                * 255
            ).astype(np.uint8)

            vis_path = (
                DEBUG_DIR
                / f"input_vis_{name}.jpg"
            )
            cv2.imwrite(
                str(vis_path),
                vis_norm,
            )

            # Inference.
            output = session.run(
                [output_info.name],
                {input_info.name: tensor},
            )[0]

            scores = np.asarray(output)[0]
            c0 = float(scores[0])
            c1 = float(scores[1])
            total = c0 + c1
            predicted = int(np.argmax(scores))

            print(
                f"  C0: {c0:.6f}  "
                f"C1: {c1:.6f}  "
                f"Sum: {total:.6f}  "
                f"Class: {predicted}"
            )

            # Interpretation under BOTH hypotheses.
            if c0 > c1:
                hyp_0_real = (
                    "-> LIVE (correct if real photo)"
                )
                hyp_0_spoof = (
                    "-> SPOOF (correct for static)"
                )
            else:
                hyp_0_real = (
                    "-> SPOOF (correct for static)"
                )
                hyp_0_spoof = (
                    "-> LIVE (WRONG for static)"
                )

            print(
                f"  If Class0=Real:  {hyp_0_real}"
            )
            print(
                f"  If Class0=Spoof: {hyp_0_spoof}"
            )

            results.append({
                "name": name,
                "desc": desc,
                "c0": c0,
                "c1": c1,
                "predicted": predicted,
                "crop_scale": crop_scale,
            })

        except Exception as exc:
            print(f"  ERROR: {exc}")
            results.append({
                "name": name,
                "desc": desc,
                "c0": None,
                "c1": None,
                "predicted": None,
                "crop_scale": crop_scale,
                "error": str(exc),
            })

    # --------------------------------------------------------
    # Summary table
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("SUMMARY TABLE")
    print("=" * 70)

    print(
        f"\n{'Var':>3} | "
        f"{'Crop':>4} | "
        f"{'C0':>8} | "
        f"{'C1':>8} | "
        f"{'Cls':>3} | "
        f"{'Description'}"
    )

    print("-" * 70)

    for r in results:
        if r.get("c0") is not None:
            print(
                f"  {r['name']:>1} | "
                f"{r['crop_scale']:>4} | "
                f"{r['c0']:>8.4f} | "
                f"{r['c1']:>8.4f} | "
                f"{r['predicted']:>3} | "
                f"{r['desc']}"
            )
        else:
            print(
                f"  {r['name']:>1} | "
                f"{r['crop_scale']:>4} | "
                f"{'ERR':>8} | "
                f"{'ERR':>8} | "
                f"{'---':>3} | "
                f"{r['desc']}"
            )

    # --------------------------------------------------------
    # Evaluate: which variant is best for static
    # photo -> SPOOF classification?
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("ANALYSIS")
    print("=" * 70)

    print(
        "\nFor a static photo (SPOOF ground truth):"
    )

    print(
        "\nHypothesis A: Class 0 = REAL, "
        "Class 1 = SPOOF"
    )
    print(
        "  -> Want HIGH C1 for static photo"
    )

    for r in results:
        if r.get("c1") is not None:
            marker = (
                " ***" if r["c1"] > 0.60 else ""
            )
            print(
                f"    {r['name']}: C1={r['c1']:.4f}"
                f"{marker}"
            )

    print(
        "\nHypothesis B: Class 0 = SPOOF, "
        "Class 1 = REAL"
    )
    print(
        "  -> Want HIGH C0 for static photo"
    )

    for r in results:
        if r.get("c0") is not None:
            marker = (
                " ***" if r["c0"] > 0.60 else ""
            )
            print(
                f"    {r['name']}: C0={r['c0']:.4f}"
                f"{marker}"
            )

    # --------------------------------------------------------
    # Process ALL faces for completeness
    # --------------------------------------------------------

    if len(detections) > 1:

        print("\n" + "=" * 70)
        print(
            "ALL FACES (using Variant A: "
            "BGR + 2.7x + OpenVINO)"
        )
        print("=" * 70)

        for idx, det in enumerate(
            detections, start=1
        ):
            bbox_i = det["bbox"]
            score_i = det["score"]

            try:
                face_crop = crop_face_scaled(
                    image, bbox_i, scale=2.7,
                )

                tensor = preprocess_variant_a(
                    face_crop
                )

                output = session.run(
                    [output_info.name],
                    {input_info.name: tensor},
                )[0]

                scores = np.asarray(output)[0]
                c0 = float(scores[0])
                c1 = float(scores[1])

                print(
                    f"\n  Face #{idx}: "
                    f"SCRFD={score_i:.3f} "
                    f"C0={c0:.4f} C1={c1:.4f} "
                    f"Class={int(np.argmax(scores))}"
                )

            except Exception as exc:
                print(
                    f"\n  Face #{idx}: ERROR {exc}"
                )

    # --------------------------------------------------------
    # Done
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)

    print(
        "\nDebug artifacts saved to: "
        f"{DEBUG_DIR}"
    )

    print(
        "\nNEXT STEP: Run this test, then run"
        " the camera test with the winning"
        " preprocessing variant."
    )


if __name__ == "__main__":
    main()
