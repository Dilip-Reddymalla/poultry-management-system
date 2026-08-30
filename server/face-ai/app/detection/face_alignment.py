from pathlib import Path

import cv2
import numpy as np


class FaceAligner:
    """
    Aligns a detected face using the 5 facial landmarks
    produced by SCRFD.

    Output:
        Standardized 112 x 112 face image.
    """

    # Standard ArcFace 112x112 landmark template.
    #
    # Order:
    #   1. left eye
    #   2. right eye
    #   3. nose
    #   4. left mouth
    #   5. right mouth
    #
    ARCFACE_TEMPLATE = np.array(
        [
            [38.2946, 51.6963],
            [73.5318, 51.5014],
            [56.0252, 71.7366],
            [41.5493, 92.3655],
            [70.7299, 92.2041],
        ],
        dtype=np.float32,
    )

    def __init__(
        self,
        output_size=(112, 112),
        target_size=None,
    ):
        self.output_size = target_size if target_size is not None else output_size

        if output_size != (112, 112):
            raise ValueError(
                "This implementation currently supports "
                "112x112 output only."
            )

    def align(
        self,
        image: np.ndarray,
        landmarks: np.ndarray,
    ) -> np.ndarray:
        """
        Align one face using its five landmarks.

        Parameters
        ----------
        image:
            Original BGR OpenCV image.

        landmarks:
            Five landmarks in the following order:

                [
                    [left_eye_x, left_eye_y],
                    [right_eye_x, right_eye_y],
                    [nose_x, nose_y],
                    [left_mouth_x, left_mouth_y],
                    [right_mouth_x, right_mouth_y],
                ]

        Returns
        -------
        np.ndarray
            Aligned 112x112 BGR face image.
        """

        # -----------------------------------------------------
        # Validate image
        # -----------------------------------------------------

        if image is None:
            raise ValueError(
                "image cannot be None"
            )

        if not isinstance(image, np.ndarray):
            raise TypeError(
                "image must be a numpy array"
            )

        if image.ndim != 3:
            raise ValueError(
                "image must have shape H x W x C"
            )

        # -----------------------------------------------------
        # Validate landmarks
        # -----------------------------------------------------

        landmarks = np.asarray(
            landmarks,
            dtype=np.float32,
        )

        if landmarks.shape != (5, 2):
            raise ValueError(
                "landmarks must have shape (5, 2), "
                f"got {landmarks.shape}"
            )

        if not np.isfinite(landmarks).all():
            raise ValueError(
                "landmarks contain invalid values"
            )

        # -----------------------------------------------------
        # Estimate similarity transformation
        # -----------------------------------------------------

        transform, _ = cv2.estimateAffinePartial2D(
            landmarks,
            self.ARCFACE_TEMPLATE,
            method=cv2.LMEDS,
        )

        if transform is None:
            raise RuntimeError(
                "Could not calculate face alignment transform"
            )

        # -----------------------------------------------------
        # Warp image
        # -----------------------------------------------------

        aligned = cv2.warpAffine(
            image,
            transform,
            self.output_size,
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0, 0, 0),
        )

        return aligned

    def align_detection(
        self,
        image: np.ndarray,
        detection: dict,
    ) -> np.ndarray:
        """
        Convenience method for a detection returned by
        SCRFDDetector.detect().
        """

        if "landmarks" not in detection:
            raise KeyError(
                "Detection does not contain landmarks"
            )

        return self.align(
            image,
            detection["landmarks"],
        )

    @staticmethod
    def save(
        image: np.ndarray,
        output_path,
    ):
        """
        Save an aligned face to disk.
        """

        output_path = Path(output_path)

        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        success = cv2.imwrite(
            str(output_path),
            image,
        )

        if not success:
            raise RuntimeError(
                f"Failed to save image: {output_path}"
            )