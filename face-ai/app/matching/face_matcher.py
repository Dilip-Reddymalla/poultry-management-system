import numpy as np


class FaceMatcher:
    """
    Compare normalized face embeddings using cosine similarity.

    MobileFaceNet embeddings produced by the current pipeline are
    expected to be 512-dimensional and L2 normalized.
    """

    def __init__(self, threshold=0.40):
        self.threshold = float(threshold)

    @staticmethod
    def normalize(embedding):
        embedding = np.asarray(
            embedding,
            dtype=np.float32,
        )

        norm = np.linalg.norm(embedding)

        if norm == 0:
            raise ValueError("Cannot normalize a zero embedding.")

        return embedding / norm

    @staticmethod
    def cosine_similarity(embedding1, embedding2):
        embedding1 = FaceMatcher.normalize(embedding1)
        embedding2 = FaceMatcher.normalize(embedding2)

        return float(np.dot(embedding1, embedding2))

    def compare(self, embedding1, embedding2):
        similarity = self.cosine_similarity(
            embedding1,
            embedding2,
        )

        return {
            "similarity": similarity,
            "matched": similarity >= self.threshold,
            "threshold": self.threshold,
        }
