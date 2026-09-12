"""
Face-AI recognition benchmark on an LFW verification subset.

Runs the SAME harness against two interchangeable backends so old and new
models are measured identically on the same machine, back-to-back:

    baseline   = SCRFD detector      + ArcFace/MobileFaceNet recognizer  (current, non-commercial)
    candidate  = YuNet detector      + EdgeFace recognizer               (commercial-safe)

For every LFW pair: detect the largest face in each image -> align to 112x112
-> embed -> cosine similarity. Genuine/impostor labels come from lfw_pairs.txt.

Metrics (numpy only, no sklearn):
    accuracy @ best threshold, ROC-AUC, TAR@FAR=1e-2 and 1e-3,
    mean genuine/impostor similarity + separation gap.
Speed (wall clock, default ORT threading, warm-up excluded):
    per-stage latency (detect / align / embed ms) and end-to-end ms,
    plus detection rate.

Usage:
    python benchmark/bench.py --backend baseline
    python benchmark/bench.py --backend candidate
    python benchmark/bench.py --backend baseline --limit 500   # quick smoke run

Results are written to benchmark/results/<backend>.json.
"""

from __future__ import annotations

# Pin threading BEFORE importing cv2 / onnxruntime so both backends are
# measured under identical, low-variance conditions.
import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import argparse
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np

# Make the `app` package importable when run from anywhere.
FACE_AI_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(FACE_AI_ROOT))

from app.core.config import settings  # noqa: E402
from app.detection.face_alignment import FaceAligner  # noqa: E402
from app.matching.face_matcher import FaceMatcher  # noqa: E402

LFW_DIR = FACE_AI_ROOT / "test_data" / "lfw"
LFW_IMAGES = LFW_DIR / "lfw_funneled"
LFW_PAIRS = LFW_DIR / "lfw_pairs.txt"
RESULTS_DIR = Path(__file__).resolve().parent / "results"

WARMUP_IMAGES = 5


# ---------------------------------------------------------------------------
# Backends
# ---------------------------------------------------------------------------


def build_backend(name: str):
    """
    Return (detector, recognizer, label) for the requested backend.

    Both detectors expose .detect(bgr) -> [{"bbox":[x1,y1,x2,y2], "score":float,
    "landmarks":[[x,y]x5]}]; both recognizers expose
    .get_embedding(aligned_bgr_112) -> np.ndarray(512,), L2-normalized.
    """
    if name == "baseline":
        from app.detection.scrfd_detector import SCRFDDetector
        from app.recognition.arcface import ArcFaceRecognizer

        detector = SCRFDDetector(
            model_path=str(settings.scrfd_model_path),
            input_size=(640, 640),
            confidence_threshold=settings.scrfd_confidence_threshold,
            nms_threshold=settings.scrfd_nms_threshold,
        )
        recognizer = ArcFaceRecognizer(model_path=str(settings.arcface_model_path))
        return detector, recognizer, "SCRFD-500M + ArcFace/MobileFaceNet (w600k_mbf)"

    if name == "candidate":
        # Imported lazily: these wrappers are added in the model-swap stage.
        from app.detection.yunet_detector import YuNetDetector
        from app.recognition.edgeface import EdgeFaceRecognizer

        detector = YuNetDetector(
            model_path=str(settings.yunet_model_path),
            score_threshold=settings.yunet_score_threshold,
            nms_threshold=settings.yunet_nms_threshold,
        )
        recognizer = EdgeFaceRecognizer(model_path=str(settings.edgeface_model_path))
        return detector, recognizer, "YuNet + EdgeFace-S (gamma=0.5)"

    raise ValueError(f"Unknown backend: {name}")


# ---------------------------------------------------------------------------
# LFW pairs
# ---------------------------------------------------------------------------


def image_path(name: str, idx: str) -> Path:
    return LFW_IMAGES / name / f"{name}_{int(idx):04d}.jpg"


def parse_pairs(limit: int | None = None) -> list[tuple[Path, Path, int]]:
    """
    Parse lfw_pairs.txt (header line = N, then N genuine, then N impostor).

    Genuine line:  Name idx1 idx2                 -> label 1
    Impostor line: Name1 idx1 Name2 idx2          -> label 0

    If limit is given, take limit//2 genuine + limit//2 impostor.
    """
    lines = LFW_PAIRS.read_text(encoding="utf-8").splitlines()
    n = int(lines[0].split()[0])

    genuine_raw = lines[1 : 1 + n]
    impostor_raw = lines[1 + n : 1 + 2 * n]

    if limit is not None:
        half = max(1, limit // 2)
        genuine_raw = genuine_raw[:half]
        impostor_raw = impostor_raw[:half]

    pairs: list[tuple[Path, Path, int]] = []

    for line in genuine_raw:
        parts = line.split("\t") if "\t" in line else line.split()
        if len(parts) != 3:
            continue
        name, i1, i2 = parts
        pairs.append((image_path(name, i1), image_path(name, i2), 1))

    for line in impostor_raw:
        parts = line.split("\t") if "\t" in line else line.split()
        if len(parts) != 4:
            continue
        n1, i1, n2, i2 = parts
        pairs.append((image_path(n1, i1), image_path(n2, i2), 0))

    return pairs


# ---------------------------------------------------------------------------
# Per-image processing
# ---------------------------------------------------------------------------


def largest_detection(detections: list[dict]) -> dict | None:
    if not detections:
        return None
    best = None
    best_area = -1.0
    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        if area > best_area:
            best_area = area
            best = det
    return best


def process_image(path: Path, detector, aligner, recognizer):
    """
    Returns (embedding | None, timings_ms dict, detected bool).
    Times detect / align / embed independently.
    """
    timings = {"detect": 0.0, "align": 0.0, "embed": 0.0}

    img = cv2.imread(str(path))
    if img is None or img.size == 0:
        return None, timings, False

    t0 = time.perf_counter()
    detections = detector.detect(img)
    timings["detect"] = (time.perf_counter() - t0) * 1000.0

    det = largest_detection(detections)
    if det is None:
        return None, timings, False

    t0 = time.perf_counter()
    aligned = aligner.align_detection(img, det)
    timings["align"] = (time.perf_counter() - t0) * 1000.0

    if aligned is None:
        return None, timings, False

    t0 = time.perf_counter()
    emb = recognizer.get_embedding(aligned)
    timings["embed"] = (time.perf_counter() - t0) * 1000.0

    return emb, timings, True


# ---------------------------------------------------------------------------
# Metrics (numpy only)
# ---------------------------------------------------------------------------


def roc_auc(scores: np.ndarray, labels: np.ndarray) -> float:
    """Tie-aware Mann-Whitney AUC = P(score_pos > score_neg)."""
    order = np.argsort(scores, kind="mergesort")
    sorted_scores = scores[order]
    # Average ranks (1-based), ties share the mean rank.
    ranks = np.empty(len(scores), dtype=np.float64)
    i = 0
    while i < len(sorted_scores):
        j = i
        while j + 1 < len(sorted_scores) and sorted_scores[j + 1] == sorted_scores[i]:
            j += 1
        avg_rank = (i + j) / 2.0 + 1.0
        ranks[order[i : j + 1]] = avg_rank
        i = j + 1

    n_pos = float(labels.sum())
    n_neg = float(len(labels) - labels.sum())
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    sum_ranks_pos = ranks[labels == 1].sum()
    return float((sum_ranks_pos - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg))


def best_accuracy(scores: np.ndarray, labels: np.ndarray) -> tuple[float, float]:
    """Sweep thresholds at every unique score, return (best_accuracy, threshold)."""
    thresholds = np.unique(scores)
    best_acc = 0.0
    best_thr = 0.0
    for thr in thresholds:
        pred = scores >= thr
        acc = float((pred == (labels == 1)).mean())
        if acc > best_acc:
            best_acc = acc
            best_thr = float(thr)
    return best_acc, best_thr


def tar_at_far(scores: np.ndarray, labels: np.ndarray, far_target: float) -> tuple[float, float]:
    """
    Highest TAR (true accept rate on genuine) achievable while the impostor
    FAR stays <= far_target. Returns (tar, threshold).
    """
    genuine = scores[labels == 1]
    impostor = scores[labels == 0]
    if len(genuine) == 0 or len(impostor) == 0:
        return float("nan"), float("nan")

    # Threshold candidates = impostor scores sorted descending; the smallest
    # threshold whose FAR <= target is just above the (k)th largest impostor.
    impostor_sorted = np.sort(impostor)[::-1]
    max_false = int(np.floor(far_target * len(impostor)))
    if max_false < 1:
        # Threshold must exceed every impostor score.
        thr = float(impostor_sorted[0]) + 1e-6
    else:
        # Allow up to max_false impostors above threshold.
        thr = float(impostor_sorted[max_false - 1])
    tar = float((genuine >= thr).mean())
    return tar, thr


def compute_metrics(sims: list[float], labels: list[int]) -> dict:
    scores = np.asarray(sims, dtype=np.float64)
    y = np.asarray(labels, dtype=np.int64)

    acc, thr = best_accuracy(scores, y)
    auc = roc_auc(scores, y)
    tar_1e2, thr_1e2 = tar_at_far(scores, y, 1e-2)
    tar_1e3, thr_1e3 = tar_at_far(scores, y, 1e-3)

    genuine = scores[y == 1]
    impostor = scores[y == 0]

    return {
        "pairs_evaluated": int(len(scores)),
        "genuine_pairs": int((y == 1).sum()),
        "impostor_pairs": int((y == 0).sum()),
        "accuracy": round(acc, 5),
        "accuracy_threshold": round(thr, 5),
        "roc_auc": round(auc, 5),
        "tar_at_far_1e-2": round(tar_1e2, 5),
        "tar_at_far_1e-3": round(tar_1e3, 5),
        "mean_genuine_sim": round(float(genuine.mean()), 5),
        "mean_impostor_sim": round(float(impostor.mean()), 5),
        "separation_gap": round(float(genuine.mean() - impostor.mean()), 5),
    }


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run(backend: str, limit: int | None) -> dict:
    detector, recognizer, label = build_backend(backend)
    aligner = FaceAligner(output_size=(112, 112))
    matcher = FaceMatcher(threshold=settings.match_threshold)

    pairs = parse_pairs(limit=limit)

    # Unique images -> process each exactly once (images repeat across pairs).
    unique_paths: list[Path] = []
    seen: set[str] = set()
    for p1, p2, _ in pairs:
        for p in (p1, p2):
            key = str(p)
            if key not in seen:
                seen.add(key)
                unique_paths.append(p)

    print(f"\nBackend : {backend} ({label})")
    print(f"Pairs   : {len(pairs)}  |  unique images: {len(unique_paths)}")

    # Warm-up (ORT lazy init) — not timed.
    for p in unique_paths[:WARMUP_IMAGES]:
        process_image(p, detector, aligner, recognizer)

    embeddings: dict[str, np.ndarray] = {}
    detect_ms: list[float] = []
    align_ms: list[float] = []
    embed_ms: list[float] = []
    detected = 0
    missing_file = 0

    for idx, p in enumerate(unique_paths, 1):
        if not p.exists():
            missing_file += 1
            continue
        emb, t, ok = process_image(p, detector, aligner, recognizer)
        if ok:
            embeddings[str(p)] = emb
            detected += 1
            detect_ms.append(t["detect"])
            align_ms.append(t["align"])
            embed_ms.append(t["embed"])
        if idx % 500 == 0:
            print(f"  processed {idx}/{len(unique_paths)} images...")

    # Pair similarities from cached embeddings.
    sims: list[float] = []
    labels: list[int] = []
    skipped = 0
    for p1, p2, lab in pairs:
        e1 = embeddings.get(str(p1))
        e2 = embeddings.get(str(p2))
        if e1 is None or e2 is None:
            skipped += 1
            continue
        sims.append(matcher.cosine_similarity(e1, e2))
        labels.append(lab)

    metrics = compute_metrics(sims, labels)

    def avg(xs: list[float]) -> float:
        return round(float(np.mean(xs)), 3) if xs else 0.0

    speed = {
        "detect_ms": avg(detect_ms),
        "align_ms": avg(align_ms),
        "embed_ms": avg(embed_ms),
        "end_to_end_ms": round(avg(detect_ms) + avg(align_ms) + avg(embed_ms), 3),
        "images_timed": len(detect_ms),
    }

    result = {
        "backend": backend,
        "model_label": label,
        "detection_rate": round(detected / max(1, len(unique_paths) - missing_file), 5),
        "images_total": len(unique_paths),
        "images_missing_file": missing_file,
        "pairs_skipped_no_detection": skipped,
        "metrics": metrics,
        "speed_ms": speed,
        "notes": "CPU, default ORT threading, OMP_NUM_THREADS=1, warm-up excluded.",
    }
    return result


def print_report(result: dict) -> None:
    m = result["metrics"]
    s = result["speed_ms"]
    print("\n" + "=" * 60)
    print(f"  RESULT — {result['backend']}: {result['model_label']}")
    print("=" * 60)
    print(f"  detection rate      : {result['detection_rate'] * 100:.2f}%")
    print(f"  pairs evaluated     : {m['pairs_evaluated']} "
          f"({m['genuine_pairs']} gen / {m['impostor_pairs']} imp)")
    print(f"  accuracy @ thr       : {m['accuracy'] * 100:.2f}%  (thr={m['accuracy_threshold']})")
    print(f"  ROC-AUC             : {m['roc_auc']:.5f}")
    print(f"  TAR @ FAR=1e-2       : {m['tar_at_far_1e-2'] * 100:.2f}%")
    print(f"  TAR @ FAR=1e-3       : {m['tar_at_far_1e-3'] * 100:.2f}%")
    print(f"  mean genuine sim     : {m['mean_genuine_sim']:.4f}")
    print(f"  mean impostor sim    : {m['mean_impostor_sim']:.4f}")
    print(f"  separation gap       : {m['separation_gap']:.4f}")
    print("  " + "-" * 56)
    print(f"  detect / align / embed ms : {s['detect_ms']} / {s['align_ms']} / {s['embed_ms']}")
    print(f"  end-to-end ms/image       : {s['end_to_end_ms']}")
    print("=" * 60 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="LFW face-recognition benchmark.")
    parser.add_argument("--backend", required=True, choices=["baseline", "candidate"])
    parser.add_argument("--limit", type=int, default=None,
                        help="Cap total pairs (half genuine, half impostor) for a quick run.")
    args = parser.parse_args()

    if not LFW_PAIRS.exists() or not LFW_IMAGES.exists():
        raise SystemExit(
            f"LFW data not found under {LFW_DIR}. Expected lfw_funneled/ and lfw_pairs.txt."
        )

    result = run(args.backend, args.limit)
    print_report(result)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = RESULTS_DIR / f"{args.backend}.json"
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"Saved -> {out}")


if __name__ == "__main__":
    main()
