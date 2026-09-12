"""
EdgeFace face embedding generator (Idiap Research Institute).

License: BSD-3-Clause
Model: EdgeFace-S (gamma=0.5) / EdgeFace-XS / EdgeFace-Base
Input: Aligned 112x112 face crop (BGR).
Output: L2-normalized 512-dimensional face embedding.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Sequence

import cv2
import numpy as np
import onnxruntime as ort

logger = logging.getLogger("face_ai.recognition.edgeface")


class EdgeFaceRecognizer:
    """
    EdgeFace-based face embedding extractor.

    Takes aligned 112x112 face crops and produces unit-length (L2-normalized)
    512-D feature vectors. Preprocessing is standard ArcFace/EdgeFace:
    BGR -> RGB, normalized to [-1, 1] via (x - 127.5) / 127.5, NCHW layout.
    """

    def __init__(
        self,
        model_path: str | Path,
        providers: Sequence[str] | None = None,
    ) -> None:
        self.model_path = Path(model_path)

        if not self.model_path.exists():
            raise FileNotFoundError(f"EdgeFace model not found: {self.model_path}")

        if providers is None:
            providers = ["CPUExecutionProvider"]

        opts = ort.SessionOptions()
        opts.log_severity_level = 3
        self.session = ort.InferenceSession(
            str(self.model_path),
            sess_options=opts,
            providers=list(providers),
        )

        self.input_name = self.session.get_inputs()[0].name
        self.input_shape = self.session.get_inputs()[0].shape
        self.output_name = self.session.get_outputs()[0].name

        logger.info(
            "EdgeFace model loaded: %s (input: %s %s, output: %s)",
            self.model_path.name,
            self.input_name,
            self.input_shape,
            self.output_name,
        )

    def preprocess(self, face: np.ndarray) -> np.ndarray:
        """
        Prepare an aligned face image for EdgeFace inference.

        Args:
            face: Aligned face crop (BGR), shape (H, W, 3).

        Returns:
            Preprocessed tensor (1, 3, 112, 112) float32 in range [-1.0, 1.0].
        """
        if face is None:
            raise ValueError("Face image is None")
        if face.size == 0:
            raise ValueError("Face image is empty")

        # Resize to 112x112 if needed
        if face.shape[:2] != (112, 112):
            face = cv2.resize(face, (112, 112), interpolation=cv2.INTER_LINEAR)

        # Convert BGR -> RGB
        face_rgb = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)

        # Normalize uint8 [0, 255] -> float32 [-1.0, 1.0]
        # Equivalent to Normalize(mean=[0.5,0.5,0.5], std=[0.5,0.5,0.5]) on [0, 1]
        tensor = (face_rgb.astype(np.float32) - 127.5) / 127.5

        # HWC -> CHW
        tensor = np.transpose(tensor, (2, 0, 1))

        # Add batch dimension: (1, 3, 112, 112)
        tensor = np.expand_dims(tensor, axis=0)

        return np.ascontiguousarray(tensor, dtype=np.float32)

    def get_embedding(self, face: np.ndarray) -> np.ndarray:
        """
        Extract normalized 512-D embedding from an aligned face.

        Args:
            face: Aligned face crop (BGR).

        Returns:
            L2-normalized 1D numpy array of shape (512,), float32.
        """
        input_tensor = self.preprocess(face)

        outputs = self.session.run(
            [self.output_name],
            {self.input_name: input_tensor},
        )

        raw_embedding = outputs[0][0]

        norm = np.linalg.norm(raw_embedding)
        if norm < 1e-12:
            raise ValueError("Model returned zero embedding vector")

        embedding = raw_embedding / norm
        return embedding.astype(np.float32)

    def embedding_from_aligned_face(self, aligned_face: np.ndarray) -> np.ndarray:
        """Alias for compatibility with ArcFaceRecognizer interface."""
        return self.get_embedding(aligned_face)
