from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


class ArcFaceRecognizer:
    """
    MobileFaceNet-based face embedding generator.

    Input:
        Aligned face image of approximately 112x112 pixels.

    Output:
        L2-normalized 512-dimensional face embedding.
    """

    def __init__(
        self,
        model_path: str,
        providers=None,
    ):
        self.model_path = Path(model_path)

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"ArcFace model not found: {self.model_path}"
            )

        if providers is None:
            providers = ["CPUExecutionProvider"]

        self.session = ort.InferenceSession(
            str(self.model_path),
            providers=providers,
        )

        # Model input
        self.input_name = self.session.get_inputs()[0].name
        self.input_shape = self.session.get_inputs()[0].shape

        # Model output
        self.output_name = self.session.get_outputs()[0].name

        print("ArcFace model loaded")
        print(f"Model: {self.model_path}")
        print(f"Input name: {self.input_name}")
        print(f"Input shape: {self.input_shape}")
        print(f"Output name: {self.output_name}")

    def preprocess(self, face: np.ndarray) -> np.ndarray:
        """
        Prepare an aligned face for MobileFaceNet.

        Expected input:
            BGR image.

        Output:
            float32 tensor with shape:
            (1, 3, 112, 112)
        """

        if face is None:
            raise ValueError("Face image is None")

        if face.size == 0:
            raise ValueError("Face image is empty")

        # Resize to the model's expected input size.
        face = cv2.resize(
            face,
            (112, 112),
            interpolation=cv2.INTER_LINEAR,
        )

        # Convert BGR -> RGB.
        face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)

        # Convert uint8 [0,255] -> float32 [-1,1].
        face = face.astype(np.float32)

        face = (face - 127.5) / 127.5

        # HWC -> CHW
        face = np.transpose(face, (2, 0, 1))

        # Add batch dimension.
        face = np.expand_dims(face, axis=0)

        return face.astype(np.float32)

    def get_embedding(self, face: np.ndarray) -> np.ndarray:
        """
        Generate a normalized 512-D embedding.

        Args:
            face:
                Aligned face image in BGR format.

        Returns:
            numpy array with shape (512,).
        """

        input_tensor = self.preprocess(face)

        outputs = self.session.run(
            [self.output_name],
            {self.input_name: input_tensor},
        )

        embedding = outputs[0][0]

        # L2 normalization.
        norm = np.linalg.norm(embedding)

        if norm < 1e-12:
            raise ValueError(
                "Model returned an invalid zero embedding."
            )

        embedding = embedding / norm

        return embedding.astype(np.float32)

    def embedding_from_aligned_face(
        self,
        aligned_face: np.ndarray,
    ) -> np.ndarray:
        """
        Convenience wrapper for an already aligned face.
        """

        return self.get_embedding(aligned_face)