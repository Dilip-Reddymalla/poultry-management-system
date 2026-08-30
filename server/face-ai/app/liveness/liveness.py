from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np
import onnxruntime as ort


class LivenessAnalyzer:
    """
    MobileNetV3-based face anti-spoofing using modelrgb.onnx.

    ONNX contract:
        Input:
            name: input
            shape: [1, 3, 112, 112]
            dtype: float32

        Output:
            name: final_actions
            shape: [1, 2]

    Model origin:
        Graph name:  antispoofing_2d_cpp_v4
        Producer:    Tencent YouTu
        Family:      MobileNetV3 binary anti-spoofing
        Related:     OpenVINO anti-spoof-mn3

    Preprocessing (verified experimentally):
        Color:       BGR (OpenCV default — do NOT convert to RGB)
        Crop:        2.7× square expansion around face bbox
        Resize:      112×112 bilinear
        Normalize:   /255.0 to [0, 1]
        Layout:      NCHW with batch=1

    Output semantics (verified experimentally):
        Class 0:     SPOOF (higher = more likely spoof)
        Class 1:     LIVE  (higher = more likely live)
        Output is already softmax probabilities (sum ≈ 1.0).
        Do NOT apply softmax again.

    The output indices are configurable via live_class_index.
    """

    INPUT_SIZE = (112, 112)

    # Experimentally verified correct crop scale.
    DEFAULT_CROP_SCALE = 2.7

    def __init__(
        self,
        model_path: str | Path,
        live_class_index: int = 1,
        live_threshold: float = 0.50,
        providers: list[str] | None = None,
    ) -> None:

        self.model_path = Path(model_path)
        self.live_class_index = int(live_class_index)
        self.live_threshold = float(live_threshold)

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Liveness model not found: {self.model_path}"
            )

        if self.live_class_index not in (0, 1):
            raise ValueError(
                "live_class_index must be 0 or 1."
            )

        if providers is None:
            providers = ["CPUExecutionProvider"]

        opts = ort.SessionOptions()
        opts.log_severity_level = 3
        self.session = ort.InferenceSession(
            str(self.model_path),
            sess_options=opts,
            providers=providers,
        )

        inputs = self.session.get_inputs()
        outputs = self.session.get_outputs()

        if len(inputs) != 1:
            raise RuntimeError(
                f"Expected exactly one input, got {len(inputs)}."
            )

        if len(outputs) != 1:
            raise RuntimeError(
                f"Expected exactly one output, got {len(outputs)}."
            )

        self.input_name = inputs[0].name
        self.output_name = outputs[0].name

        self.input_shape = inputs[0].shape
        self.input_type = inputs[0].type

        self.output_shape = outputs[0].shape
        self.output_type = outputs[0].type

        # Validate the known model contract.
        self._validate_model()

    # ------------------------------------------------------------------
    # Model validation
    # ------------------------------------------------------------------

    def _validate_model(self) -> None:

        if self.input_shape != [1, 3, 112, 112]:
            raise RuntimeError(
                "Unexpected liveness input shape. "
                f"Expected [1, 3, 112, 112], "
                f"got {self.input_shape}"
            )

        if self.input_type != "tensor(float)":
            raise RuntimeError(
                "Unexpected liveness input type. "
                f"Expected tensor(float), "
                f"got {self.input_type}"
            )

        if self.output_shape != [1, 2]:
            raise RuntimeError(
                "Unexpected liveness output shape. "
                f"Expected [1, 2], "
                f"got {self.output_shape}"
            )

        if self.output_type != "tensor(float)":
            raise RuntimeError(
                "Unexpected liveness output type. "
                f"Expected tensor(float), "
                f"got {self.output_type}"
            )

    # ------------------------------------------------------------------
    # Information
    # ------------------------------------------------------------------

    def model_info(self) -> dict[str, Any]:

        return {
            "model_path": str(self.model_path),
            "input_name": self.input_name,
            "input_shape": self.input_shape,
            "input_type": self.input_type,
            "output_name": self.output_name,
            "output_shape": self.output_shape,
            "output_type": self.output_type,
            "input_size": self.INPUT_SIZE,
            "color_order": "BGR",
            "normalization": "[0, 1] (/255.0)",
            "crop_scale": self.DEFAULT_CROP_SCALE,
            "live_class_index": self.live_class_index,
            "live_threshold": self.live_threshold,
            "output_activation": "softmax (built-in)",
            "providers": self.session.get_providers(),
        }

    # ------------------------------------------------------------------
    # Face crop
    # ------------------------------------------------------------------

    def crop_face(
        self,
        image: np.ndarray,
        bbox: list[float] | tuple[float, float, float, float],
        scale: float | None = None,
    ) -> np.ndarray:
        """
        Create a SQUARE enlarged face crop centered
        on the SCRFD bounding box.

        The crop is made square by using the larger of
        width/height before applying the scale factor.
        This ensures consistent aspect ratio for the
        anti-spoofing model.

        Parameters
        ----------
        image : np.ndarray
            Source image (BGR).
        bbox : list[float]
            [x1, y1, x2, y2] from SCRFD.
        scale : float, optional
            Crop expansion factor.
            Defaults to DEFAULT_CROP_SCALE (2.7).
        """

        if scale is None:
            scale = self.DEFAULT_CROP_SCALE

        if image is None or image.size == 0:
            raise ValueError("Input image is empty.")

        if len(bbox) != 4:
            raise ValueError(
                "bbox must contain [x1, y1, x2, y2]."
            )

        x1, y1, x2, y2 = map(float, bbox)

        width = x2 - x1
        height = y2 - y1

        if width <= 0 or height <= 0:
            raise ValueError(
                f"Invalid bbox: {bbox}"
            )

        center_x = (x1 + x2) / 2.0
        center_y = (y1 + y2) / 2.0

        # SQUARE crop based on the larger dimension.
        side = max(width, height)

        crop_side = side * scale

        crop_x1 = int(
            round(center_x - crop_side / 2.0)
        )
        crop_y1 = int(
            round(center_y - crop_side / 2.0)
        )
        crop_x2 = int(
            round(center_x + crop_side / 2.0)
        )
        crop_y2 = int(
            round(center_y + crop_side / 2.0)
        )

        image_height, image_width = image.shape[:2]

        crop_x1 = max(0, crop_x1)
        crop_y1 = max(0, crop_y1)
        crop_x2 = min(image_width, crop_x2)
        crop_y2 = min(image_height, crop_y2)

        if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
            raise ValueError(
                "Generated face crop is invalid."
            )

        crop = image[
            crop_y1:crop_y2,
            crop_x1:crop_x2,
        ]

        if crop.size == 0:
            raise ValueError(
                "Generated face crop is empty."
            )

        return crop

    # ------------------------------------------------------------------
    # Preprocessing
    # ------------------------------------------------------------------

    def preprocess(
        self,
        face_crop: np.ndarray,
    ) -> np.ndarray:
        """
        Preprocess a BGR face crop for liveness inference.

        Pipeline:
            1. Keep BGR (do NOT convert to RGB)
            2. Resize to 112×112
            3. Float32 conversion
            4. Normalize to [0, 1]
            5. HWC → CHW
            6. Add batch dimension
        """

        if face_crop is None or face_crop.size == 0:
            raise ValueError(
                "Face crop is empty."
            )

        # The model expects BGR input.
        # OpenCV images are already BGR.
        # Do NOT convert to RGB.

        resized = cv2.resize(
            face_crop,
            self.INPUT_SIZE,
            interpolation=cv2.INTER_LINEAR,
        )

        # Float32 conversion.
        tensor = resized.astype(
            np.float32
        )

        # Normalize to [0, 1].
        tensor /= 255.0

        # HWC -> CHW.
        tensor = np.transpose(
            tensor,
            (2, 0, 1),
        )

        # Add batch dimension.
        tensor = np.expand_dims(
            tensor,
            axis=0,
        )

        return tensor.astype(
            np.float32
        )

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(
        self,
        face_crop: np.ndarray,
    ) -> dict[str, Any]:
        """
        Run liveness inference on a single BGR face crop.

        The model output (final_actions) is already
        softmax probabilities. No additional activation
        is applied.

        Returns a dict with:
            decision: "LIVE" or "SPOOF"
            is_live: bool
            score: float (live class probability)
            scores: dict with class_0, class_1, live, spoof
            raw_output: list[float]
            live_class_index: int
            reasons: list[str]
        """

        input_tensor = self.preprocess(
            face_crop
        )

        outputs = self.session.run(
            [self.output_name],
            {
                self.input_name:
                    input_tensor
            },
        )

        if not outputs:
            raise RuntimeError(
                "Liveness model returned no output."
            )

        raw_output = np.asarray(
            outputs[0]
        )

        if raw_output.shape != (1, 2):
            raise RuntimeError(
                "Unexpected liveness output shape: "
                f"{raw_output.shape}"
            )

        # The model output is already softmax
        # probabilities. Do NOT apply softmax again.
        probabilities = raw_output[0]

        class_0 = float(
            probabilities[0]
        )

        class_1 = float(
            probabilities[1]
        )

        live_score = float(
            probabilities[
                self.live_class_index
            ]
        )

        spoof_class_index = (
            1
            if self.live_class_index == 0
            else 0
        )

        spoof_score = float(
            probabilities[
                spoof_class_index
            ]
        )

        is_live = (
            live_score
            >= self.live_threshold
        )

        decision = (
            "LIVE"
            if is_live
            else "SPOOF"
        )

        reasons: list[str] = []

        if not is_live:
            reasons.append(
                "liveness_score_below_threshold"
            )

        return {
            "decision": decision,
            "is_live": is_live,
            "score": live_score,
            "scores": {
                "class_0": class_0,
                "class_1": class_1,
                "live": live_score,
                "spoof": spoof_score,
            },
            "raw_output": [
                float(probabilities[0]),
                float(probabilities[1]),
            ],
            "live_class_index": (
                self.live_class_index
            ),
            "reasons": reasons,
        }

    # ------------------------------------------------------------------
    # Complete analysis
    # ------------------------------------------------------------------

    def analyze(
        self,
        image: np.ndarray,
        bbox: list[float]
        | tuple[float, float, float, float],
        crop_scale: float | None = None,
    ) -> dict[str, Any]:
        """
        Full liveness analysis: crop + predict.

        Parameters
        ----------
        image : np.ndarray
            Source image (BGR).
        bbox : list[float]
            [x1, y1, x2, y2] from SCRFD.
        crop_scale : float, optional
            Crop expansion factor.
            Defaults to DEFAULT_CROP_SCALE (2.7).
        """

        if crop_scale is None:
            crop_scale = self.DEFAULT_CROP_SCALE

        face_crop = self.crop_face(
            image=image,
            bbox=bbox,
            scale=crop_scale,
        )

        result = self.predict(
            face_crop
        )

        result["bbox"] = [
            float(bbox[0]),
            float(bbox[1]),
            float(bbox[2]),
            float(bbox[3]),
        ]

        result["model"] = (
            "Tencent YouTu Anti-Spoofing"
        )

        result["input_size"] = (
            "112x112"
        )

        result["color_order"] = "BGR"

        result["crop_scale"] = crop_scale

        return result