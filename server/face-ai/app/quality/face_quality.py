from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np
import onnxruntime as ort


class FaceQualityAnalyzer:
    """
    Learned + deterministic face quality analyzer using Qualcomm Light-FaceQ
    (face_det_lite.onnx) coupled with geometric, landmark, and sharpness checks.

    Pipeline Placement:
        SCRFD Detection -> FaceQualityAnalyzer -> Liveness -> ArcFace Recognition

    Model specifications (face_det_lite.onnx):
        Input:  input [1, 1, 480, 640] uint16 (grayscale, uint16 quantized range [0, 65535])
        Outputs:
            heatmap  [1, 1, 60, 80] uint16 (scale=0.00011156859545735642, zero_point=47397)
            bbox     [1, 4, 60, 80] uint16
            landmark [1, 10, 60, 80] uint16
    """

    INPUT_SIZE = (640, 480)  # Width=640, Height=480

    # Quantization parameters from model metadata
    SCALE_INPUT = 1.5259021893143654e-05
    SCALE_HEATMAP = 0.00011156859545735642
    ZERO_POINT_HEATMAP = 47397

    def __init__(
        self,
        model_path: str | Path | None = None,
        quality_threshold: float = 0.35,
        min_face_width: int = 32,
        min_face_height: int = 32,
        min_face_area_ratio: float = 0.001,
        min_detection_confidence: float = 0.35,
        min_sharpness: float = 15.0,
        use_sharpness: bool = True,
        providers: list[str] | None = None,
    ) -> None:

        if model_path is None:
            project_root = Path(__file__).resolve().parent.parent.parent
            model_path = project_root / "models" / "quality" / "face_det_lite.onnx"

        self.model_path = Path(model_path)
        self.quality_threshold = float(quality_threshold)
        self.min_face_width = int(min_face_width)
        self.min_face_height = int(min_face_height)
        self.min_face_area_ratio = float(min_face_area_ratio)
        self.min_detection_confidence = float(min_detection_confidence)
        self.min_sharpness = float(min_sharpness)
        self.use_sharpness = bool(use_sharpness)

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Face quality model not found: {self.model_path}"
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

        self.input_name = inputs[0].name
        self.input_shape = inputs[0].shape
        self.input_type = inputs[0].type

        self.output_names = [out.name for out in outputs]
        self.output_shapes = [out.shape for out in outputs]

    # ------------------------------------------------------------------
    # Model Information
    # ------------------------------------------------------------------

    def model_info(self) -> dict[str, Any]:
        return {
            "model_name": "Light-FaceQ (Qualcomm face_det_lite)",
            "model_path": str(self.model_path),
            "input_name": self.input_name,
            "input_shape": self.input_shape,
            "input_type": self.input_type,
            "output_names": self.output_names,
            "output_shapes": self.output_shapes,
            "input_size": self.INPUT_SIZE,
            "quality_threshold": self.quality_threshold,
            "min_face_width": self.min_face_width,
            "min_face_height": self.min_face_height,
            "min_face_area_ratio": self.min_face_area_ratio,
            "min_detection_confidence": self.min_detection_confidence,
            "min_sharpness": self.min_sharpness,
            "use_sharpness": self.use_sharpness,
            "providers": self.session.get_providers(),
        }

    # ------------------------------------------------------------------
    # Crop Face
    # ------------------------------------------------------------------

    def crop_face(
        self,
        image: np.ndarray,
        bbox: list[float] | tuple[float, ...],
        scale: float = 1.2,
    ) -> np.ndarray:
        """
        Crop a face region from the image based on bounding box.
        Clamps to image bounds and ensures valid non-empty array.
        """
        if image is None or image.size == 0:
            raise ValueError("Input image is empty.")

        if len(bbox) != 4:
            raise ValueError("bbox must contain [x1, y1, x2, y2].")

        x1, y1, x2, y2 = map(float, bbox)
        w = x2 - x1
        h = y2 - y1

        if w <= 0 or h <= 0:
            raise ValueError(f"Invalid bounding box dimensions: {bbox}")

        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0

        nw = w * scale
        nh = h * scale

        crop_x1 = max(0, int(round(cx - nw / 2.0)))
        crop_y1 = max(0, int(round(cy - nh / 2.0)))
        crop_x2 = min(image.shape[1], int(round(cx + nw / 2.0)))
        crop_y2 = min(image.shape[0], int(round(cy + nh / 2.0)))

        if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
            raise ValueError(f"Crop coordinates invalid: {[crop_x1, crop_y1, crop_x2, crop_y2]}")

        crop = image[crop_y1:crop_y2, crop_x1:crop_x2]
        if crop.size == 0:
            raise ValueError("Generated face crop is empty.")

        return crop

    # ------------------------------------------------------------------
    # Preprocessing
    # ------------------------------------------------------------------

    def preprocess(self, face_crop: np.ndarray) -> np.ndarray:
        """
        Preprocess face crop for Light-FaceQ model.
        Pipeline: Grayscale -> Resize (640, 480) -> Scale [0..1] -> Quantize uint16 -> [1, 1, 480, 640]
        """
        if face_crop is None or face_crop.size == 0:
            raise ValueError("Face crop is empty.")

        if len(face_crop.shape) == 3 and face_crop.shape[2] == 3:
            gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        else:
            gray = face_crop

        resized = cv2.resize(gray, self.INPUT_SIZE, interpolation=cv2.INTER_LINEAR)
        norm = resized.astype(np.float32) / 255.0

        uint16_tensor = np.round(norm / self.SCALE_INPUT).astype(np.uint16)
        tensor = np.expand_dims(np.expand_dims(uint16_tensor, axis=0), axis=0)

        return tensor

    # ------------------------------------------------------------------
    # Sharpness calculation
    # ------------------------------------------------------------------

    @staticmethod
    def calculate_sharpness(face_crop: np.ndarray) -> float:
        """
        Calculates image sharpness using Laplacian variance.
        """
        if face_crop is None or face_crop.size == 0:
            return 0.0

        if len(face_crop.shape) == 3 and face_crop.shape[2] == 3:
            gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        else:
            gray = face_crop

        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # ------------------------------------------------------------------
    # Landmark Validation
    # ------------------------------------------------------------------

    @staticmethod
    def validate_landmarks(
        landmarks: list[list[float]] | np.ndarray | None,
        bbox: list[float] | tuple[float, ...],
    ) -> bool:
        """
        Validates 5-point facial landmarks (left_eye, right_eye, nose, left_mouth, right_mouth).
        Checks coordinate finiteness, relative positioning, and bounding box proximity.
        """
        if landmarks is None:
            return True

        pts = np.asarray(landmarks, dtype=np.float32)
        if pts.shape == (10,):
            pts = pts.reshape(5, 2)
        elif pts.shape != (5, 2):
            return False

        if not np.all(np.isfinite(pts)):
            return False

        x1, y1, x2, y2 = map(float, bbox)
        bw = max(1.0, x2 - x1)
        bh = max(1.0, y2 - y1)

        # Allow margin around bounding box (50% expansion margin for landmarks)
        margin_x = bw * 0.5
        margin_y = bh * 0.5

        for px, py in pts:
            if not (x1 - margin_x <= px <= x2 + margin_x and y1 - margin_y <= py <= y2 + margin_y):
                return False

        left_eye, right_eye, nose, left_mouth, right_mouth = pts

        # Eye horizontal relationship: right eye x > left eye x
        eye_dx = right_eye[0] - left_eye[0]
        if eye_dx <= 0:
            return False

        # Nose y should generally be below eye region (or slightly above in extreme tilt)
        eye_avg_y = (left_eye[1] + right_eye[1]) / 2.0
        mouth_avg_y = (left_mouth[1] + right_mouth[1]) / 2.0

        if mouth_avg_y <= eye_avg_y:
            return False

        return True

    # ------------------------------------------------------------------
    # Light-FaceQ Model Prediction
    # ------------------------------------------------------------------

    def predict(self, face_crop: np.ndarray) -> dict[str, Any]:
        """
        Execute Light-FaceQ ONNX model on a preprocessed face crop.
        Calculates quality score from sigmoid of dequantized heatmap peak.
        """
        tensor = self.preprocess(face_crop)

        outputs = self.session.run(None, {self.input_name: tensor})
        heatmap_raw = outputs[0]

        heatmap_dequant = (heatmap_raw.astype(np.float32) - self.ZERO_POINT_HEATMAP) * self.SCALE_HEATMAP
        
        # Apply sigmoid to map heatmap logits to [0.0, 1.0] probability range
        heatmap_prob = 1.0 / (1.0 + np.exp(-np.clip(heatmap_dequant, -10.0, 10.0)))

        quality_score = float(np.max(heatmap_prob))

        return {
            "quality_score": quality_score,
            "raw_heatmap_min": float(heatmap_dequant.min()),
            "raw_heatmap_max": float(heatmap_dequant.max()),
            "raw_heatmap_mean": float(heatmap_dequant.mean()),
            "prob_heatmap_max": quality_score,
            "prob_heatmap_mean": float(heatmap_prob.mean()),
        }

    # ------------------------------------------------------------------
    # Full Quality Analysis
    # ------------------------------------------------------------------

    def analyze(
        self,
        image: np.ndarray,
        bbox: list[float] | tuple[float, ...],
        landmarks: list[list[float]] | np.ndarray | None = None,
        detection_confidence: float | None = None,
    ) -> dict[str, Any]:
        """
        Full quality evaluation: geometric, detection confidence, landmarks, sharpness, and Light-FaceQ score.
        """
        reasons: list[str] = []

        if image is None or image.size == 0:
            return {
                "usable": False,
                "decision": "REJECT",
                "quality_score": 0.0,
                "reasons": ["empty_image"],
                "metrics": {},
                "model": {"name": "Light-FaceQ", "score": 0.0},
            }

        img_h, img_w = image.shape[:2]
        img_area = float(img_w * img_h)

        # 1. Bounding box & Geometric Validation
        if len(bbox) != 4:
            return {
                "usable": False,
                "decision": "REJECT",
                "quality_score": 0.0,
                "reasons": ["invalid_bbox_length"],
                "metrics": {},
                "model": {"name": "Light-FaceQ", "score": 0.0},
            }

        x1, y1, x2, y2 = map(float, bbox)
        fw = x2 - x1
        fh = y2 - y1
        face_area = float(fw * fh) if (fw > 0 and fh > 0) else 0.0
        relative_area = face_area / img_area if img_area > 0 else 0.0

        if fw <= 0 or fh <= 0:
            reasons.append("invalid_bbox")
        
        # Check if bbox is completely outside image
        if x2 <= 0 or y2 <= 0 or x1 >= img_w or y1 >= img_h:
            reasons.append("face_out_of_bounds")

        if fw < self.min_face_width or fh < self.min_face_height:
            reasons.append("face_too_small")

        if relative_area < self.min_face_area_ratio:
            reasons.append("face_area_ratio_too_low")

        # 2. Detection Confidence Validation
        det_conf = float(detection_confidence) if detection_confidence is not None else None
        if det_conf is not None and det_conf < self.min_detection_confidence:
            reasons.append("low_detection_confidence")

        # 3. Landmark Validation
        landmarks_valid = self.validate_landmarks(landmarks, bbox)
        if not landmarks_valid:
            reasons.append("invalid_landmarks")

        # Extract face crop if geometric bounds permit
        face_crop = None
        sharpness_val = None
        quality_score = 0.0
        model_metrics = {}

        if "invalid_bbox" not in reasons and "face_out_of_bounds" not in reasons:
            try:
                face_crop = self.crop_face(image, bbox, scale=1.0)
            except Exception as exc:
                reasons.append(f"crop_failed:{exc}")

        if face_crop is not None and face_crop.size > 0:
            # 4. Sharpness Check
            if self.use_sharpness:
                sharpness_val = self.calculate_sharpness(face_crop)
                if sharpness_val < self.min_sharpness:
                    reasons.append("low_sharpness")

            # 5. Light-FaceQ Model Evaluation
            try:
                pred = self.predict(face_crop)
                quality_score = pred["quality_score"]
                model_metrics = pred
                if quality_score < self.quality_threshold:
                    reasons.append("low_quality_score")
            except Exception as exc:
                reasons.append(f"model_inference_failed:{exc}")

        usable = len(reasons) == 0
        decision = "ACCEPT" if usable else "REJECT"

        return {
            "usable": usable,
            "decision": decision,
            "quality_score": quality_score,
            "reasons": reasons,
            "metrics": {
                "face_width": int(round(fw)),
                "face_height": int(round(fh)),
                "face_area": float(face_area),
                "relative_area": float(relative_area),
                "detection_confidence": det_conf,
                "sharpness": sharpness_val,
                "landmarks_valid": landmarks_valid,
            },
            "model": {
                "name": "Light-FaceQ (Qualcomm face_det_lite)",
                "input_size": "640x480 (grayscale uint16)",
                "score": quality_score,
                "details": model_metrics,
            },
        }
