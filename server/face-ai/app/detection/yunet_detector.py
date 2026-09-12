"""
YuNet face detector wrapper using OpenCV's cv2.FaceDetectorYN.

License: MIT (OpenCV Zoo)
Output format: Identical to SCRFDDetector:
    [
        {
            "bbox": [x1, y1, x2, y2],
            "score": float,
            "landmarks": [[x, y] x 5],
        },
        ...
    ]
sorted by confidence score descending.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger("face_ai.detection.yunet")


class YuNetDetector:
    """
    YuNet Face Detector (OpenCV Zoo).

    Uses cv2.FaceDetectorYN with dynamic input sizing and standardizes 5-point
    facial landmarks to ArcFace template order:
        0: left eye
        1: right eye
        2: nose tip
        3: left mouth corner
        4: right mouth corner
    """

    def __init__(
        self,
        model_path: str,
        score_threshold: float = 0.6,
        nms_threshold: float = 0.3,
        top_k: int = 5000,
        max_size: int | None = 1024,
        backend_id: int = cv2.dnn.DNN_BACKEND_OPENCV,
        target_id: int = cv2.dnn.DNN_TARGET_CPU,
    ) -> None:
        self.model_path = Path(model_path)
        self.score_threshold = float(score_threshold)
        self.nms_threshold = float(nms_threshold)
        self.top_k = int(top_k)
        self.max_size = max_size

        if not self.model_path.exists():
            raise FileNotFoundError(f"YuNet model not found: {self.model_path}")

        # Initial dummy input size (128, 128); setInputSize is called per frame
        self.detector = cv2.FaceDetectorYN.create(
            model=str(self.model_path),
            config="",
            input_size=(128, 128),
            score_threshold=self.score_threshold,
            nms_threshold=self.nms_threshold,
            top_k=self.top_k,
            backend_id=backend_id,
            target_id=target_id,
        )

        logger.info(
            "YuNet detector initialized (model: %s, score_thr: %.2f, nms_thr: %.2f, max_size: %s)",
            self.model_path.name,
            self.score_threshold,
            self.nms_threshold,
            self.max_size,
        )

    def detect(self, image: np.ndarray) -> list[dict[str, Any]]:
        """
        Detect faces in a BGR image.

        Args:
            image: BGR image as numpy array (H, W, 3).

        Returns:
            List of detected faces sorted by score descending:
            [
                {
                    "bbox": [x1, y1, x2, y2],
                    "score": float,
                    "landmarks": [
                        [left_eye_x, left_eye_y],
                        [right_eye_x, right_eye_y],
                        [nose_x, nose_y],
                        [left_mouth_x, left_mouth_y],
                        [right_mouth_x, right_mouth_y],
                    ],
                },
                ...
            ]
        """
        if image is None or image.size == 0:
            return []

        orig_h, orig_w = image.shape[:2]
        if orig_h <= 0 or orig_w <= 0:
            return []

        scale = 1.0
        if self.max_size is not None and max(orig_h, orig_w) > self.max_size:
            scale = float(self.max_size) / float(max(orig_h, orig_w))
            net_w = int(round(orig_w * scale))
            net_h = int(round(orig_h * scale))
            detect_img = cv2.resize(image, (net_w, net_h), interpolation=cv2.INTER_LINEAR)
        else:
            detect_img = image
            net_w, net_h = orig_w, orig_h

        # YuNet expects (width, height) tuple
        self.detector.setInputSize((net_w, net_h))

        _, faces = self.detector.detect(detect_img)

        if faces is None or len(faces) == 0:
            return []

        results: list[dict[str, Any]] = []

        # Each row in faces is 15-dim:
        # [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rc, y_rc, x_lc, y_lc, score]
        for row in faces:
            x = float(row[0]) / scale
            y = float(row[1]) / scale
            w = float(row[2]) / scale
            h = float(row[3]) / scale
            score = float(row[14])

            # Clip bounding box to image bounds
            x1 = max(0.0, min(x, float(orig_w - 1)))
            y1 = max(0.0, min(y, float(orig_h - 1)))
            x2 = max(0.0, min(x + w, float(orig_w - 1)))
            y2 = max(0.0, min(y + h, float(orig_h - 1)))

            if x2 <= x1 or y2 <= y1:
                continue

            # YuNet landmark output layout:
            #   row[4, 5]:   subject's right eye (viewer's left / image left) -> Point 0
            #   row[6, 7]:   subject's left eye  (viewer's right / image right) -> Point 1
            #   row[8, 9]:   nose tip                                          -> Point 2
            #   row[10, 11]: subject's right mouth corner (viewer's left)      -> Point 3
            #   row[12, 13]: subject's left mouth corner  (viewer's right)     -> Point 4
            pt_left_eye = [
                float(np.clip(row[4] / scale, 0.0, orig_w - 1)),
                float(np.clip(row[5] / scale, 0.0, orig_h - 1)),
            ]
            pt_right_eye = [
                float(np.clip(row[6] / scale, 0.0, orig_w - 1)),
                float(np.clip(row[7] / scale, 0.0, orig_h - 1)),
            ]
            pt_nose = [
                float(np.clip(row[8] / scale, 0.0, orig_w - 1)),
                float(np.clip(row[9] / scale, 0.0, orig_h - 1)),
            ]
            pt_left_mouth = [
                float(np.clip(row[10] / scale, 0.0, orig_w - 1)),
                float(np.clip(row[11] / scale, 0.0, orig_h - 1)),
            ]
            pt_right_mouth = [
                float(np.clip(row[12] / scale, 0.0, orig_w - 1)),
                float(np.clip(row[13] / scale, 0.0, orig_h - 1)),
            ]

            landmarks = [pt_left_eye, pt_right_eye, pt_nose, pt_left_mouth, pt_right_mouth]

            results.append(
                {
                    "bbox": [x1, y1, x2, y2],
                    "score": score,
                    "landmarks": landmarks,
                }
            )

        # Sort highest score first
        results.sort(key=lambda item: item["score"], reverse=True)
        return results
