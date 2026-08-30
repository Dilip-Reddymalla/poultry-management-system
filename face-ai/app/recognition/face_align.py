from typing import Tuple

import cv2
import numpy as np


# Standard ArcFace 5-point landmark template for 112x112 faces.
ARCFACE_TEMPLATE = np.array(
    [
        [38.2946, 51.6963],  # left eye
        [73.5318, 51.5014],  # right eye
        [56.0252, 71.7366],  # nose
        [41.5493, 92.3655],  # left mouth
        [70.7299, 92.2041],  # right mouth
    ],
    dtype=np.float32,
)


def align_face(
    image: np.ndarray,
    landmarks: np.ndarray,
    output_size: Tuple[int, int] = (112, 112),
) -> np.ndarray:
    """
    Align a face using five facial landmarks.

    Args:
        image:
            Original BGR image.

        landmarks:
            Five landmarks in this order:
            [left_eye, right_eye, nose, left_mouth, right_mouth]

            Shape:
            (5, 2)

        output_size:
            Output face size. Default: 112x112.

    Returns:
        Aligned BGR face image.
    """

    if image is None or image.size == 0:
        raise ValueError("Input image is empty.")

    landmarks = np.asarray(landmarks, dtype=np.float32)

    if landmarks.shape != (5, 2):
        raise ValueError(
            f"Expected landmarks with shape (5, 2), "
            f"got {landmarks.shape}"
        )

    width, height = output_size

    if (width, height) != (112, 112):
        # Scale the standard ArcFace template if another size is requested.
        target = ARCFACE_TEMPLATE.copy()

        target[:, 0] *= width / 112.0
        target[:, 1] *= height / 112.0
    else:
        target = ARCFACE_TEMPLATE

    # Estimate similarity transformation:
    #
    # source landmarks → ArcFace template
    #
    transform, _ = cv2.estimateAffinePartial2D(
        landmarks,
        target,
        method=cv2.LMEDS,
    )

    if transform is None:
        raise RuntimeError(
            "Could not calculate face alignment transform."
        )

    aligned = cv2.warpAffine(
        image,
        transform,
        (width, height),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )

    return aligned