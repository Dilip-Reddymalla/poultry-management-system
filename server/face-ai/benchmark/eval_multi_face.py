"""
Multi-Face Image Evaluation and Metrics Report.

Evaluates the new commercial-safe models (YuNet + EdgeFace-S) on multi-face images:
1. In-repo multi-face dataset images (e.g. person2_2.jpg)
2. Multi-face images detected from the LFW dataset
3. Comprehensive metrics per face: BBox, Detection Score, Quality Score & Decision,
   Liveness Decision, Recognition Match Identity & Similarity, and Latencies.
"""

import sys
import time
from pathlib import Path

FACE_AI_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(FACE_AI_ROOT))

import cv2
import numpy as np

from app.core.config import settings
from app.services.face_pipeline import FacePipeline


def evaluate_image(pipeline: FacePipeline, img_path: Path):
    img = cv2.imread(str(img_path))
    if img is None:
        print(f"Error: could not read {img_path}")
        return None

    t0 = time.perf_counter()
    response = pipeline.analyze_image(img, filename=img_path.name)
    total_time_ms = (time.perf_counter() - t0) * 1000

    return {
        "path": img_path,
        "filename": img_path.name,
        "dimensions": (img.shape[1], img.shape[0]),
        "face_count": response.face_count,
        "process_time_ms": response.process_time_ms,
        "wall_time_ms": total_time_ms,
        "faces": response.faces,
    }


def find_lfw_multi_face_images(pipeline: FacePipeline, max_find: int = 5) -> list[Path]:
    lfw_dir = FACE_AI_ROOT / "test_data" / "lfw" / "lfw_funneled"
    if not lfw_dir.exists():
        return []

    multi_face_paths: list[Path] = []
    # Sample various directories from LFW
    for img_path in lfw_dir.rglob("*.jpg"):
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        faces = pipeline.detector.detect(img)
        if len(faces) >= 2:
            multi_face_paths.append(img_path)
            if len(multi_face_paths) >= max_find:
                break
    return multi_face_paths


def main():
    print("=" * 80)
    print("MULTI-FACE IMAGES EVALUATION — NEW COMMERCIAL MODELS")
    print(f"Detector   : {settings.detector_backend} ({settings.yunet_model_path.name})")
    print(f"Recognizer : {settings.recognizer_backend} ({settings.edgeface_model_path.name})")
    print(f"Liveness   : {settings.liveness_backend} (Enabled: {settings.enable_liveness})")
    print(f"Quality Thr: {settings.quality_threshold} (Min Conf: {settings.quality_min_detection_confidence})")
    print("=" * 80)

    pipeline = FacePipeline()
    print(f"\nIndexed {len(pipeline.reference_embeddings)} reference identities:")
    for name, embs in pipeline.reference_embeddings.items():
        print(f"  - {name}: {len(embs)} template embedding(s)")

    # 1. Primary in-repo test images
    in_repo_images = [
        FACE_AI_ROOT / "test_data" / "recognition" / "person2" / "person2_2.jpg",
        FACE_AI_ROOT / "test_data" / "test.jpg",
        FACE_AI_ROOT / "test_data" / "recognition" / "person1" / "person1_1.jpg",
    ]

    # 2. Add multi-face images found in LFW
    lfw_multi = find_lfw_multi_face_images(pipeline, max_find=3)

    all_test_images = [p for p in in_repo_images if p.exists()] + lfw_multi

    print(f"\nEvaluating {len(all_test_images)} test images...\n")

    summary_records = []

    for img_path in all_test_images:
        res = evaluate_image(pipeline, img_path)
        if not res:
            continue

        w, h = res["dimensions"]
        print("-" * 80)
        print(f"Image: {res['filename']} ({w}x{h}) | Faces Found: {res['face_count']} | Pipeline Time: {res['process_time_ms']:.2f}ms")
        print("-" * 80)

        for f in res["faces"]:
            bbox_str = f"[{f.bbox[0]:.1f}, {f.bbox[1]:.1f}, {f.bbox[2]:.1f}, {f.bbox[3]:.1f}]"
            w_box = f.bbox[2] - f.bbox[0]
            h_box = f.bbox[3] - f.bbox[1]
            q = f.quality
            r = f.recognition
            l = f.liveness

            q_score_str = f"{q.quality_score:.4f}" if q.quality_score is not None else "N/A"
            sharpness_str = f"{q.metrics.sharpness:.1f}" if q.metrics and q.metrics.sharpness is not None else "N/A"
            sim_str = f"{r.similarity:.4f}" if r.similarity is not None else "N/A"
            match_id = r.identity if r.identity else "None"

            print(f"  Face #{f.face_index}:")
            print(f"    • Detection   : conf={f.detection_confidence:.4f}, size={w_box:.0f}x{h_box:.0f}, bbox={bbox_str}")
            liv_str = f"decision={l.decision} (score={l.score:.2f})" if l is not None else "SKIPPED (Quality REJECT)"
            print(f"    • Quality     : decision={q.decision} (score={q_score_str}, sharpness={sharpness_str}, usable={q.usable})")
            print(f"    • Liveness    : {liv_str}")
            print(f"    • Recognition : status={r.status}, match={match_id}, similarity={sim_str}")
            if r.candidates:
                cand_str = ", ".join([f"{c.identity}:{c.similarity:.3f}" for c in r.candidates[:3]])
                print(f"    • Candidates  : [{cand_str}]")

            summary_records.append({
                "image": res["filename"],
                "face_idx": f.face_index,
                "det_conf": f.detection_confidence,
                "box_size": f"{w_box:.0f}x{h_box:.0f}",
                "q_decision": q.decision,
                "q_score": q.quality_score,
                "rec_status": r.status,
                "rec_match": match_id,
                "rec_sim": r.similarity,
            })

    print("\n" + "=" * 80)
    print("SUMMARY TABLE — ALL DETECTED FACES")
    print("=" * 80)
    print(f"{'Image':<22} | {'Face':<5} | {'DetConf':<8} | {'BoxSize':<9} | {'Quality':<8} | {'Q-Score':<8} | {'Status':<18} | {'Match':<10} | {'Similarity'}")
    print("-" * 115)
    for s in summary_records:
        qs = f"{s['q_score']:.3f}" if s['q_score'] is not None else "N/A"
        sim = f"{s['rec_sim']:.4f}" if s['rec_sim'] is not None else "N/A"
        print(f"{s['image']:<22} | #{s['face_idx']:<4} | {s['det_conf']:<8.4f} | {s['box_size']:<9} | {s['q_decision']:<8} | {qs:<8} | {s['rec_status']:<18} | {s['rec_match']:<10} | {sim}")
    print("=" * 115)


if __name__ == "__main__":
    main()
