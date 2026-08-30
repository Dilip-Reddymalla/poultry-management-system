from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


class SCRFDDetector:
    """
    SCRFD 500M KPS face detector.

    Responsibilities:
        1. Load SCRFD ONNX model
        2. Preprocess image
        3. Run ONNX inference
        4. Decode bounding boxes
        5. Decode 5 facial landmarks
        6. Apply confidence filtering
        7. Apply Non-Maximum Suppression (NMS)
    """

    def __init__(
        self,
        model_path: str,
        input_size=(640, 640),
        confidence_threshold=0.5,
        nms_threshold=0.4,
    ):
        self.model_path = Path(model_path)
        self.input_size = input_size
        self.confidence_threshold = confidence_threshold
        self.nms_threshold = nms_threshold

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"SCRFD model not found: {self.model_path}"
            )

        # SCRFD uses three feature-map strides.
        self.strides = [8, 16, 32]

        # Load ONNX model.
        opts = ort.SessionOptions()
        opts.log_severity_level = 3
        self.session = ort.InferenceSession(
            str(self.model_path),
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )

        self.input_name = self.session.get_inputs()[0].name

        # Verify model input.
        print("SCRFD model loaded")
        print(f"Model: {self.model_path}")
        print(f"Input name: {self.input_name}")
        print(f"Input size: {self.input_size}")
        print(
            f"Confidence threshold: "
            f"{self.confidence_threshold}"
        )
        print(
            f"NMS threshold: "
            f"{self.nms_threshold}"
        )

    # ---------------------------------------------------------
    # PREPROCESSING
    # ---------------------------------------------------------

    def preprocess(self, image):
        """
        Resize and normalize image for SCRFD.

        Input:
            BGR OpenCV image

        Output:
            input_tensor
            resize_scale
        """

        if image is None:
            raise ValueError("Input image is None")

        original_height, original_width = image.shape[:2]

        target_width, target_height = self.input_size

        # SCRFD expects RGB-style normalized values.
        image_rgb = cv2.cvtColor(
            image,
            cv2.COLOR_BGR2RGB,
        )

        # Resize to model input.
        resized = cv2.resize(
            image_rgb,
            (target_width, target_height),
            interpolation=cv2.INTER_LINEAR,
        )

        # Convert to float32.
        resized = resized.astype(np.float32)

        # SCRFD normalization:
        #
        # (pixel - 127.5) / 128.0
        #
        resized = (
            resized - 127.5
        ) / 128.0

        # HWC -> CHW
        resized = np.transpose(
            resized,
            (2, 0, 1),
        )

        # Add batch dimension.
        input_tensor = np.expand_dims(
            resized,
            axis=0,
        ).astype(np.float32)

        # Because we're resizing the complete image to
        # 640x640, x/y scaling can differ.
        scale_x = target_width / original_width
        scale_y = target_height / original_height

        return input_tensor, scale_x, scale_y

    # ---------------------------------------------------------
    # ANCHOR GENERATION
    # ---------------------------------------------------------

    def generate_anchors(self):
        """
        Generate SCRFD anchor centers.

        SCRFD 500M KPS uses:
            stride 8
            stride 16
            stride 32

        The exported model has 2 anchors per spatial location.

        Returns:
            list[np.ndarray]:
                One array per stride with shape:
                (num_predictions, 2)
        """

        target_width, target_height = self.input_size

        num_anchors = 2

        anchors = []

        for stride in self.strides:

            feature_width = target_width // stride
            feature_height = target_height // stride

            centers = []

            for y in range(feature_height):
                for x in range(feature_width):

                    cx = x * stride + stride / 2
                    cy = y * stride + stride / 2

                    for _ in range(num_anchors):
                        centers.append([cx, cy])

            anchors.append(
                np.asarray(
                    centers,
                    dtype=np.float32,
                )
            )

        return anchors

    # ---------------------------------------------------------
    # BOUNDING BOX DECODING
    # ---------------------------------------------------------

    def decode_bbox(
        self,
        bbox_predictions,
        anchors,
        stride,
    ):
        """
        Decode SCRFD bounding-box predictions.

        SCRFD bbox output contains:

            left
            top
            right
            bottom

        distances relative to anchor center.
        """

        bbox_predictions = (
            bbox_predictions * stride
        )

        x1 = (
            anchors[:, 0]
            - bbox_predictions[:, 0]
        )

        y1 = (
            anchors[:, 1]
            - bbox_predictions[:, 1]
        )

        x2 = (
            anchors[:, 0]
            + bbox_predictions[:, 2]
        )

        y2 = (
            anchors[:, 1]
            + bbox_predictions[:, 3]
        )

        boxes = np.stack(
            [x1, y1, x2, y2],
            axis=1,
        )

        return boxes

    # ---------------------------------------------------------
    # KEYPOINT DECODING
    # ---------------------------------------------------------

    def decode_keypoints(
        self,
        kps_predictions,
        anchors,
        stride,
    ):
        """
        Decode SCRFD 5-point facial landmarks.

        KPS output:

            x1, y1,
            x2, y2,
            x3, y3,
            x4, y4,
            x5, y5

        Returns:
            shape: (N, 5, 2)
        """

        kps_predictions = (
            kps_predictions * stride
        )

        keypoints = []

        for i in range(5):

            x = (
                anchors[:, 0]
                + kps_predictions[:, 2 * i]
            )

            y = (
                anchors[:, 1]
                + kps_predictions[:, 2 * i + 1]
            )

            keypoints.append(
                np.stack(
                    [x, y],
                    axis=1,
                )
            )

        return np.stack(
            keypoints,
            axis=1,
        )

    # ---------------------------------------------------------
    # NMS
    # ---------------------------------------------------------

    def nms(
        self,
        boxes,
        scores,
    ):
        """
        Non-Maximum Suppression.

        Removes overlapping duplicate detections.
        """

        if len(boxes) == 0:
            return []

        x1 = boxes[:, 0]
        y1 = boxes[:, 1]
        x2 = boxes[:, 2]
        y2 = boxes[:, 3]

        areas = (
            np.maximum(0, x2 - x1)
            * np.maximum(0, y2 - y1)
        )

        order = scores.argsort()[::-1]

        keep = []

        while len(order) > 0:

            current = order[0]

            keep.append(current)

            if len(order) == 1:
                break

            remaining = order[1:]

            xx1 = np.maximum(
                x1[current],
                x1[remaining],
            )

            yy1 = np.maximum(
                y1[current],
                y1[remaining],
            )

            xx2 = np.minimum(
                x2[current],
                x2[remaining],
            )

            yy2 = np.minimum(
                y2[current],
                y2[remaining],
            )

            width = np.maximum(
                0,
                xx2 - xx1,
            )

            height = np.maximum(
                0,
                yy2 - yy1,
            )

            intersection = (
                width * height
            )

            union = (
                areas[current]
                + areas[remaining]
                - intersection
            )

            iou = np.zeros_like(
                intersection
            )

            valid_union = union > 0

            iou[valid_union] = (
                intersection[valid_union]
                / union[valid_union]
            )

            order = remaining[
                iou <= self.nms_threshold
            ]

        return keep

    # ---------------------------------------------------------
    # DETECTION
    # ---------------------------------------------------------

    def detect(self, image):
        """
        Detect faces in an OpenCV BGR image.

        Returns a list:

        [
            {
                "bbox": [x1, y1, x2, y2],
                "score": float,
                "landmarks": [[x, y], ...]
            }
        ]
        """

        original_height, original_width = (
            image.shape[:2]
        )

        # -----------------------------
        # Preprocess
        # -----------------------------

        input_tensor, scale_x, scale_y = (
            self.preprocess(image)
        )

        # -----------------------------
        # Inference
        # -----------------------------

        outputs = self.session.run(
            None,
            {
                self.input_name: input_tensor
            },
        )

        # -----------------------------
        # Map outputs by name
        # -----------------------------

        output_names = [
            output.name
            for output in self.session.get_outputs()
        ]

        output_map = dict(
            zip(output_names, outputs)
        )

        all_boxes = []
        all_scores = []
        all_keypoints = []

        anchors_by_stride = (
            self.generate_anchors()
        )

        # -----------------------------
        # Process each stride
        # -----------------------------

        for index, stride in enumerate(
            self.strides
        ):

            score_name = f"score_{stride}"
            bbox_name = f"bbox_{stride}"
            kps_name = f"kps_{stride}"

            scores = output_map[
                score_name
            ]

            bbox_predictions = output_map[
                bbox_name
            ]

            kps_predictions = output_map[
                kps_name
            ]

            # Remove batch dimension.
            scores = np.squeeze(
                scores,
                axis=0,
            )

            bbox_predictions = np.squeeze(
                bbox_predictions,
                axis=0,
            )

            kps_predictions = np.squeeze(
                kps_predictions,
                axis=0,
            )

            # Flatten score from:
            #
            # (N, 1)
            #
            # to:
            #
            # (N,)
            scores = scores.reshape(-1)

            anchors = anchors_by_stride[
                index
            ]

            # -------------------------------------------------
            # Safety check
            # -------------------------------------------------

            if len(scores) != len(anchors):
                raise RuntimeError(
                    f"SCRFD output/anchor mismatch "
                    f"at stride {stride}: "
                    f"scores={len(scores)}, "
                    f"anchors={len(anchors)}"
                )

            # -------------------------------------------------
            # Confidence filtering
            # -------------------------------------------------

            valid = (
                scores
                >= self.confidence_threshold
            )

            if not np.any(valid):
                continue

            scores_valid = scores[valid]

            bbox_valid = (
                bbox_predictions[valid]
            )

            kps_valid = (
                kps_predictions[valid]
            )

            anchors_valid = anchors[valid]

            # -------------------------------------------------
            # Decode
            # -------------------------------------------------

            boxes = self.decode_bbox(
                bbox_valid,
                anchors_valid,
                stride,
            )

            keypoints = (
                self.decode_keypoints(
                    kps_valid,
                    anchors_valid,
                    stride,
                )
            )

            all_boxes.append(boxes)
            all_scores.append(scores_valid)
            all_keypoints.append(keypoints)

        # -----------------------------
        # No detections
        # -----------------------------

        if not all_boxes:
            return []

        # -----------------------------
        # Combine all strides
        # -----------------------------

        boxes = np.concatenate(
            all_boxes,
            axis=0,
        )

        scores = np.concatenate(
            all_scores,
            axis=0,
        )

        keypoints = np.concatenate(
            all_keypoints,
            axis=0,
        )

        # -----------------------------
        # NMS
        # -----------------------------

        keep = self.nms(
            boxes,
            scores,
        )

        # -----------------------------
        # Convert back to original
        # image coordinates
        # -----------------------------

        results = []

        for index in keep:

            box = boxes[index].copy()

            box[0] /= scale_x
            box[1] /= scale_y
            box[2] /= scale_x
            box[3] /= scale_y

            box[0] = max(
                0,
                min(
                    box[0],
                    original_width - 1,
                ),
            )

            box[1] = max(
                0,
                min(
                    box[1],
                    original_height - 1,
                ),
            )

            box[2] = max(
                0,
                min(
                    box[2],
                    original_width - 1,
                ),
            )

            box[3] = max(
                0,
                min(
                    box[3],
                    original_height - 1,
                ),
            )

            points = (
                keypoints[index].copy()
            )

            points[:, 0] /= scale_x
            points[:, 1] /= scale_y

            points[:, 0] = np.clip(
                points[:, 0],
                0,
                original_width - 1,
            )

            points[:, 1] = np.clip(
                points[:, 1],
                0,
                original_height - 1,
            )

            results.append(
                {
                    "bbox": box.tolist(),
                    "score": float(
                        scores[index]
                    ),
                    "landmarks": (
                        points.tolist()
                    ),
                }
            )

        # Highest confidence first.
        results.sort(
            key=lambda item: item["score"],
            reverse=True,
        )

        return results