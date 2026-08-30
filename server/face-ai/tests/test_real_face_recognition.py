import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np

from app.detection.scrfd_detector import SCRFDDetector
from app.detection.face_alignment import FaceAligner
from app.recognition.arcface import ArcFaceRecognizer
from app.matching.face_matcher import FaceMatcher


TEST_DIR = PROJECT_ROOT / "test_data"

SCRFD_MODEL = (
    PROJECT_ROOT
    / "models"
    / "scrfd"
    / "scrfd_500m_bnkps.onnx"
)

ARCFACE_MODEL = (
    PROJECT_ROOT
    / "models"
    / "arcface"
    / "buffalo_s"
    / "w600k_mbf.onnx"
)


def extract_embedding(
    image_path,
    detector,
    aligner,
    recognizer,
):
    """
    Generate an embedding from either:

    1. A normal/raw image:
       image -> SCRFD -> alignment -> MobileFaceNet

    2. An already aligned 112x112 face:
       image -> MobileFaceNet

    Returns:
        embedding, detection_score
    """

    image = cv2.imread(str(image_path))

    if image is None:
        raise RuntimeError(
            f"Could not read image: {image_path}"
        )

    height, width = image.shape[:2]

    # ---------------------------------------------------------
    # Already aligned face
    # ---------------------------------------------------------
    #
    # aligned_face.jpg and pipeline_aligned_face.jpg are
    # already 112x112 face crops. Do NOT run SCRFD on them.
    #
    if (width, height) == (112, 112):
        print("  Input type: already aligned face")

        embedding = recognizer.embedding_from_aligned_face(
            image
        )

        return (
            np.asarray(
                embedding,
                dtype=np.float32,
            ),
            None,
        )

    # ---------------------------------------------------------
    # Normal image
    # ---------------------------------------------------------

    print("  Input type: raw image")

    detections = detector.detect(image)

    if not detections:
        raise RuntimeError(
            f"No face detected in: {image_path.name}"
        )

    # Select strongest face
    detection = max(
        detections,
        key=lambda item: item["score"],
    )

    print(
        f"  Face detection score: "
        f"{detection['score']:.6f}"
    )

    # ---------------------------------------------------------
    # Align
    # ---------------------------------------------------------

    aligned = aligner.align_detection(
        image,
        detection,
    )

    if aligned is None:
        raise RuntimeError(
            f"Face alignment failed: {image_path.name}"
        )

    if aligned.shape != (112, 112, 3):
        raise RuntimeError(
            f"Unexpected aligned face shape for "
            f"{image_path.name}: {aligned.shape}"
        )

    # ---------------------------------------------------------
    # Generate embedding
    # ---------------------------------------------------------

    embedding = recognizer.get_embedding(
        aligned
    )

    embedding = np.asarray(
        embedding,
        dtype=np.float32,
    )

    return embedding, detection["score"]




def get_person_name(path):
    """
    person1_1.jpg -> person1
    person1_2.jpg -> person1
    person2_1.jpg -> person2
    """
    return path.stem.rsplit("_", 1)[0]


def main():

    print("=" * 70)
    print("REAL MULTI-IMAGE FACE RECOGNITION TEST")
    print("=" * 70)

    # ---------------------------------------------------------
    # Find test images
    # ---------------------------------------------------------

    image_paths = sorted(
        [
            p
            for p in TEST_DIR.iterdir()
            if p.suffix.lower()
            in [".jpg", ".jpeg", ".png"]
            and "_" in p.stem
        ]
    )

    if len(image_paths) < 2:
        raise RuntimeError(
            "Need at least 2 test images."
        )

    print("\nTest images:")

    for path in image_paths:
        print(
            f"  {path.name} -> "
            f"{get_person_name(path)}"
        )

    # ---------------------------------------------------------
    # Initialize models
    # ---------------------------------------------------------

    print("\n1. Loading SCRFD...")

    detector = SCRFDDetector(
        model_path=str(SCRFD_MODEL),
        input_size=(640, 640),
        confidence_threshold=0.20,
        nms_threshold=0.40,
    )

    print("\n2. Loading face aligner...")

    aligner = FaceAligner(
        output_size=(112, 112)
    )

    print("\n3. Loading MobileFaceNet...")

    recognizer = ArcFaceRecognizer(
        model_path=str(ARCFACE_MODEL)
    )

    print("\n4. Loading FaceMatcher...")

    matcher = FaceMatcher(
        threshold=0.40
    )

    # ---------------------------------------------------------
    # Generate embeddings
    # ---------------------------------------------------------

    print("\n5. Generating embeddings...")
    print("-" * 70)

    embeddings = {}
    detection_scores = {}

    for path in image_paths:

        print(
            f"Processing: {path.name}"
        )

        embedding, score = extract_embedding(
            path,
            detector,
            aligner,
            recognizer,
        )

        embeddings[path.name] = embedding
        detection_scores[path.name] = score

        
        if score is not None:
            print(
                f"  Detection score: {score:.6f}"
            )
        else:
            print(
                "  Detection score: N/A "
                "(already aligned input)"
            )



        print(
            f"  Embedding shape: {embedding.shape}"
        )

        print(
            f"  L2 norm: "
            f"{np.linalg.norm(embedding):.6f}"
        )

        if embedding.shape != (512,):
            raise RuntimeError(
                f"Invalid embedding shape for "
                f"{path.name}: {embedding.shape}"
            )

        if not np.all(np.isfinite(embedding)):
            raise RuntimeError(
                f"Embedding contains NaN/Inf: "
                f"{path.name}"
            )

    # ---------------------------------------------------------
    # Pairwise comparison
    # ---------------------------------------------------------

    print("\n6. Pairwise face comparisons")
    print("=" * 70)

    results = []

    for i in range(len(image_paths)):

        for j in range(i + 1, len(image_paths)):

            path_a = image_paths[i]
            path_b = image_paths[j]

            embedding_a = embeddings[path_a.name]
            embedding_b = embeddings[path_b.name]

            result = matcher.compare(
                embedding_a,
                embedding_b,
            )

            person_a = get_person_name(path_a)
            person_b = get_person_name(path_b)

            same_person = (
                person_a == person_b
            )

            similarity = result["similarity"]

            results.append(
                (
                    path_a.name,
                    path_b.name,
                    same_person,
                    similarity,
                )
            )

            expected = (
                "SAME"
                if same_person
                else "DIFFERENT"
            )

            print(
                f"\n{path_a.name}"
                f"  <->  "
                f"{path_b.name}"
            )

            print(
                f"  Expected:   {expected}"
            )

            print(
                f"  Similarity: {similarity:.6f}"
            )

            print(
                f"  Threshold:  "
                f"{matcher.threshold:.6f}"
            )

            print(
                f"  Matcher:    "
                f"{'MATCH' if result['matched'] else 'NO MATCH'}"
            )

    # ---------------------------------------------------------
    # Analyze results
    # ---------------------------------------------------------

    same_scores = [
        similarity
        for _, _, same, similarity in results
        if same
    ]

    different_scores = [
        similarity
        for _, _, same, similarity in results
        if not same
    ]

    print("\n")
    print("=" * 70)
    print("7. SIMILARITY SUMMARY")
    print("=" * 70)

    if same_scores:

        print("\nSAME-PERSON comparisons:")

        for score in same_scores:
            print(
                f"  {score:.6f}"
            )

        print(
            f"\n  Minimum: {min(same_scores):.6f}"
        )

        print(
            f"  Maximum: {max(same_scores):.6f}"
        )

        print(
            f"  Average: {np.mean(same_scores):.6f}"
        )

    else:
        print(
            "\nNo same-person pairs found."
        )

    if different_scores:

        print("\nDIFFERENT-PERSON comparisons:")

        for score in different_scores:
            print(
                f"  {score:.6f}"
            )

        print(
            f"\n  Minimum: {min(different_scores):.6f}"
        )

        print(
            f"  Maximum: {max(different_scores):.6f}"
        )

        print(
            f"  Average: "
            f"{np.mean(different_scores):.6f}"
        )

    else:
        print(
            "\nNo different-person pairs found."
        )

    # ---------------------------------------------------------
    # Threshold analysis
    # ---------------------------------------------------------

    print("\n")
    print("=" * 70)
    print("8. THRESHOLD ANALYSIS")
    print("=" * 70)

    threshold = matcher.threshold

    if same_scores:

        same_below = [
            s for s in same_scores
            if s < threshold
        ]

        print(
            f"\nSame-person below threshold "
            f"({threshold:.2f}): "
            f"{len(same_below)} / "
            f"{len(same_scores)}"
        )

    if different_scores:

        different_above = [
            s for s in different_scores
            if s >= threshold
        ]

        print(
            f"Different-person above threshold "
            f"({threshold:.2f}): "
            f"{len(different_above)} / "
            f"{len(different_scores)}"
        )

    print("\nNOTE:")
    print(
        "The 0.40 threshold is still provisional."
    )
    print(
        "Do not treat this small test set as "
        "a final threshold calibration."
    )

    # ---------------------------------------------------------
    # Final validation
    # ---------------------------------------------------------

    errors = []

    for (
        image_a,
        image_b,
        same_person,
        similarity,
    ) in results:

        matched = similarity >= threshold

        if same_person and not matched:

            errors.append(
                f"False rejection: "
                f"{image_a} vs {image_b}"
            )

        if not same_person and matched:

            errors.append(
                f"False acceptance: "
                f"{image_a} vs {image_b}"
            )

    print("\n")
    print("=" * 70)

    if errors:

        print("RECOGNITION VALIDATION FAILED")
        print("=" * 70)

        for error in errors:
            print(
                f"  ? {error}"
            )

        raise RuntimeError(
            "One or more expected matches "
            "failed."
        )

    print(
        "REAL MULTI-IMAGE RECOGNITION TEST PASSED"
    )

    print("=" * 70)


if __name__ == "__main__":
    main()
