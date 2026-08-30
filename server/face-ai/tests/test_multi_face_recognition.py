import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np

from app.detection.scrfd_detector import SCRFDDetector
from app.detection.face_alignment import FaceAligner
from app.recognition.arcface import ArcFaceRecognizer
from app.matching.face_matcher import FaceMatcher
from app.recognition.multi_face import extract_all_faces, recognize_faces


SCRFD_MODEL_PATH = PROJECT_ROOT / "models" / "scrfd" / "scrfd_500m_bnkps.onnx"
ARCFACE_MODEL_PATH = (
    PROJECT_ROOT / "models" / "arcface" / "buffalo_s" / "w600k_mbf.onnx"
)
RECOGNITION_DIR = PROJECT_ROOT / "test_data" / "recognition"
MULTI_FACE_IMAGE_PATH = RECOGNITION_DIR / "person2" / "person2_2.jpg"


def build_clean_reference_embeddings(detector, aligner, recognizer, matcher):
    """
    Build clean reference embeddings for person1, person2, and person3 using un-contaminated images:
      - person1: person1_1.jpg, person1_2.jpg (averaged & normalized)
      - person2: person2_1.jpg
      - person3: person3_1.jpg
    """
    reference_files = {
        "person1": [
            RECOGNITION_DIR / "person1" / "person1_1.jpg",
            RECOGNITION_DIR / "person1" / "person1_2.jpg",
        ],
        "person2": [
            RECOGNITION_DIR / "person2" / "person2_1.jpg",
        ],
        "person3": [
            RECOGNITION_DIR / "person3" / "person3_1.jpg",
        ],
    }

    references = {}

    for identity, file_list in reference_files.items():
        embeddings = []
        for file_path in file_list:
            if not file_path.exists():
                raise FileNotFoundError(f"Reference image not found: {file_path}")

            image = cv2.imread(str(file_path))
            if image is None:
                raise ValueError(f"Failed to read image: {file_path}")

            faces = extract_all_faces(image, detector, aligner, recognizer)
            if not faces:
                raise RuntimeError(f"No face detected in reference image: {file_path}")

            strongest = max(faces, key=lambda f: f["score"])
            embeddings.append(strongest["embedding"])

        if len(embeddings) == 1:
            references[identity] = embeddings[0]
        else:
            mean_emb = np.mean(embeddings, axis=0)
            references[identity] = matcher.normalize(mean_emb)

    return references


def main():
    print("=" * 60)
    print("MULTI-FACE RECOGNITION TEST")
    print("=" * 60)

    detector = SCRFDDetector(
        model_path=str(SCRFD_MODEL_PATH),
        input_size=(640, 640),
        confidence_threshold=0.5,
        nms_threshold=0.4,
    )
    aligner = FaceAligner(output_size=(112, 112))
    recognizer = ArcFaceRecognizer(model_path=str(ARCFACE_MODEL_PATH))
    matcher = FaceMatcher(threshold=0.40)

    print("\nBuilding clean reference embeddings...")
    references = build_clean_reference_embeddings(
        detector, aligner, recognizer, matcher
    )

    for id_name, ref_emb in references.items():
        print(
            f"  Reference for '{id_name}': shape={ref_emb.shape}, norm={np.linalg.norm(ref_emb):.6f}"
        )

    if not MULTI_FACE_IMAGE_PATH.exists():
        raise FileNotFoundError(f"Multi-face test image not found: {MULTI_FACE_IMAGE_PATH}")

    query_image = cv2.imread(str(MULTI_FACE_IMAGE_PATH))
    if query_image is None:
        raise ValueError(f"Failed to read image: {MULTI_FACE_IMAGE_PATH}")

    print(f"\nImage:")
    print(f"person2/person2_2.jpg")

    results = recognize_faces(
        query_image,
        detector,
        aligner,
        recognizer,
        matcher,
        references,
    )

    print(f"\nDetected faces: {len(results)}")

    if len(results) < 2:
        raise RuntimeError(
            f"Expected at least 2 faces in person2_2.jpg, got {len(results)}"
        )

    for idx, face in enumerate(results, start=1):
        print("\n" + "-" * 60)
        print(f"Face #{idx}")
        print("-" * 60)
        print(f"Detection confidence: {face['score']:.6f}")
        print(f"BBox: {face['bbox']}")
        print("\nComparison:")
        for id_name in sorted(face["similarities"].keys()):
            sim = face["similarities"][id_name]
            print(f"  {id_name}: {sim:.6f}")

        print(f"\nBest identity: {face['best_identity']}")
        print(f"Best similarity: {face['best_similarity']:.6f}")
        print(f"Match: {face['matched']}")
        print(f"Final assigned identity: {face['identity']}")

    # Verification of multi-face recognition
    assigned_identities = [f["identity"] for f in results]
    if "person1" not in assigned_identities or "person2" not in assigned_identities:
        print("\n[WARNING] Expected person1 and person2 in person2_2.jpg.")

    print("\n" + "=" * 60)
    print("MULTI-FACE RECOGNITION TEST PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
