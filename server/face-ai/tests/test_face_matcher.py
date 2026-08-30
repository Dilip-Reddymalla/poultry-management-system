import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np

from app.matching.face_matcher import FaceMatcher


def main():

    print("=" * 60)
    print("FACE MATCHER TEST")
    print("=" * 60)

    matcher = FaceMatcher(threshold=0.40)

    print("\n1. Creating test embedding...")

    rng = np.random.default_rng(42)

    embedding_a = rng.normal(
        size=512
    ).astype(np.float32)

    embedding_a = matcher.normalize(
        embedding_a
    )

    print(
        f"Embedding A shape: {embedding_a.shape}"
    )

    print(
        f"Embedding A norm: "
        f"{np.linalg.norm(embedding_a):.6f}"
    )

    print("\n2. Same embedding comparison...")

    result_same = matcher.compare(
        embedding_a,
        embedding_a,
    )

    print(
        f"Similarity: "
        f"{result_same['similarity']:.6f}"
    )

    print(
        f"Threshold: "
        f"{result_same['threshold']:.6f}"
    )

    print(
        f"Matched: "
        f"{result_same['matched']}"
    )

    if result_same["similarity"] < 0.999:
        raise RuntimeError(
            "Same embedding should have similarity near 1.0"
        )

    if not result_same["matched"]:
        raise RuntimeError(
            "Same embedding was not matched."
        )

    print("? Same-person comparison passed")

    print("\n3. Different embedding comparison...")

    embedding_b = rng.normal(
        size=512
    ).astype(np.float32)

    embedding_b = matcher.normalize(
        embedding_b
    )

    result_different = matcher.compare(
        embedding_a,
        embedding_b,
    )

    print(
        f"Similarity: "
        f"{result_different['similarity']:.6f}"
    )

    print(
        f"Threshold: "
        f"{result_different['threshold']:.6f}"
    )

    print(
        f"Matched: "
        f"{result_different['matched']}"
    )

    if result_different["similarity"] >= 0.95:
        raise RuntimeError(
            "Random embeddings unexpectedly have "
            "very high similarity."
        )

    print("? Different-person comparison passed")

    print("\n4. Testing invalid embedding...")

    try:
        matcher.cosine_similarity(
            np.zeros(512, dtype=np.float32),
            embedding_a,
        )

        raise RuntimeError(
            "Zero embedding should have raised ValueError."
        )

    except ValueError:
        print("? Zero embedding correctly rejected")

    print("\n" + "=" * 60)
    print("FACE MATCHER TEST PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
