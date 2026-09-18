"""
MiniFASNetV2 Silent-Face Anti-Spoofing wrapper.

License: Apache-2.0 (MiniVision / Silent-Face-Anti-Spoofing)
Input: 80x80 BGR image (CHW, [0, 1])
Output: 3-class classification (Class 1 = Real/Live, Class 0 & 2 = Spoof).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Sequence

import cv2
import numpy as np
import onnxruntime as ort

logger = logging.getLogger("face_ai.liveness.minifasnet")


class MiniFASNetLiveness:
    """
    MiniFASNetV2 Anti-Spoofing Analyzer.

    Uses a square face crop with scale factor (default 2.7x), resized to 80x80.
    The 3-class output head produces softmax probabilities where index 1 is LIVE.
    """

    INPUT_SIZE = (80, 80)
    DEFAULT_CROP_SCALE = 2.7
    LIVE_CLASS_INDEX = 1

    def __init__(
        self,
        model_path: str | Path,
        live_threshold: float = 0.50,
        providers: Sequence[str] | None = None,
    ) -> None:
        self.model_path = Path(model_path)
        self.live_threshold = float(live_threshold)

        if not self.model_path.exists():
            raise FileNotFoundError(f"MiniFASNet model not found: {self.model_path}")

        if providers is None:
            providers = ["CPUExecutionProvider"]

        opts = ort.SessionOptions()
        opts.log_severity_level = 3
        self.session = ort.InferenceSession(
            str(self.model_path),
            sess_options=opts,
            providers=list(providers),
        )

        inputs = self.session.get_inputs()
        outputs = self.session.get_outputs()

        self.input_name = inputs[0].name
        self.input_shape = inputs[0].shape
        self.output_name = outputs[0].name
        self.output_shape = outputs[0].shape

        logger.info(
            "MiniFASNetV2 loaded: %s (input: %s %s, output: %s %s, thr: %.2f)",
            self.model_path.name,
            self.input_name,
            self.input_shape,
            self.output_name,
            self.output_shape,
            self.live_threshold,
        )

    def crop_face(
        self,
        image: np.ndarray,
        bbox: list[float] | tuple[float, float, float, float],
        scale: float | None = None,
    ) -> np.ndarray:
        """
        Extract a square face crop centered on the bounding box, enlarged by scale.
        """
        if scale is None:
            scale = self.DEFAULT_CROP_SCALE

        if image is None or image.size == 0:
            raise ValueError("Input image is empty.")

        if len(bbox) != 4:
            raise ValueError("bbox must contain [x1, y1, x2, y2].")

        x1, y1, x2, y2 = map(float, bbox)
        width = x2 - x1
        height = y2 - y1

        if width <= 0 or height <= 0:
            raise ValueError(f"Invalid bbox: {bbox}")

        center_x = (x1 + x2) / 2.0
        center_y = (y1 + y2) / 2.0

        # Square crop based on larger dimension
        side = max(width, height)
        crop_side = side * scale

        crop_x1 = int(round(center_x - crop_side / 2.0))
        crop_y1 = int(round(center_y - crop_side / 2.0))
        crop_x2 = int(round(center_x + crop_side / 2.0))
        crop_y2 = int(round(center_y + crop_side / 2.0))

        image_height, image_width = image.shape[:2]

        crop_x1 = max(0, crop_x1)
        crop_y1 = max(0, crop_y1)
        crop_x2 = min(image_width, crop_x2)
        crop_y2 = min(image_height, crop_y2)

        if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
            raise ValueError("Generated face crop is invalid.")

        crop = image[crop_y1:crop_y2, crop_x1:crop_x2]
        if crop.size == 0:
            raise ValueError("Generated face crop is empty.")

        return crop

    def preprocess(self, face_crop: np.ndarray) -> np.ndarray:
        """
        Preprocess face crop: resize to 80x80, normalize to [0, 1], CHW layout.
        Keeps BGR order per Silent-Face convention.
        """
        if face_crop is None or face_crop.size == 0:
            raise ValueError("Face crop is empty.")

        resized = cv2.resize(face_crop, self.INPUT_SIZE, interpolation=cv2.INTER_LINEAR)
        tensor = resized.astype(np.float32) / 255.0
        tensor = np.transpose(tensor, (2, 0, 1))  # HWC -> CHW
        tensor = np.expand_dims(tensor, axis=0)   # (1, 3, 80, 80)
        return np.ascontiguousarray(tensor, dtype=np.float32)

    def predict(self, face_crop: np.ndarray) -> dict[str, Any]:
        """
        Run liveness classification on an extracted face crop.
        """
        input_tensor = self.preprocess(face_crop)
        outputs = self.session.run([self.output_name], {self.input_name: input_tensor})
        raw_output = np.asarray(outputs[0])[0]

        # Apply softmax over logits
        exp_vals = np.exp(raw_output - np.max(raw_output))
        probabilities = exp_vals / np.sum(exp_vals)

        class_0 = float(probabilities[0])
        class_1 = float(probabilities[1])
        class_2 = float(probabilities[2]) if len(probabilities) > 2 else 0.0

        live_score = class_1
        spoof_score = 1.0 - live_score

        is_live = live_score >= self.live_threshold
        decision = "LIVE" if is_live else "SPOOF"

        reasons: list[str] = []
        if not is_live:
            reasons.append("liveness_score_below_threshold")

        return {
            "decision": decision,
            "is_live": is_live,
            "score": live_score,
            "scores": {
                "class_0": class_0,
                "class_1": class_1,
                "class_2": class_2,
                "live": live_score,
                "spoof": spoof_score,
            },
            "raw_output": [float(p) for p in probabilities],
            "live_class_index": self.LIVE_CLASS_INDEX,
            "reasons": reasons,
        }

    def analyze(
        self,
        image: np.ndarray,
        bbox: list[float] | tuple[float, float, float, float],
        crop_scale: float | None = None,
    ) -> dict[str, Any]:
        """
        Full liveness analysis: crop from image + predict.
        """
        if crop_scale is None:
            crop_scale = self.DEFAULT_CROP_SCALE

        face_crop = self.crop_face(image=image, bbox=bbox, scale=crop_scale)
        result = self.predict(face_crop)

        result["bbox"] = [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])]
        result["model"] = "MiniFASNetV2"
        result["input_size"] = "80x80"
        result["color_order"] = "BGR"
        result["crop_scale"] = crop_scale

        return result
