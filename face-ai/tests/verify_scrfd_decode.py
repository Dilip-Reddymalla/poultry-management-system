from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


MODEL_PATH = Path("models/scrfd/scrfd_500m_bnkps.onnx")
IMAGE_PATH = Path("test_data/test.jpg")

INPUT_SIZE = (640, 640)

STRIDES = [8, 16, 32]

CONFIDENCE_THRESHOLD = 0.20


def preprocess(image):
    """
    Resize image to 640x640 and normalize using
    the SCRFD configuration:

        mean = [127.5, 127.5, 127.5]
        std  = [128.0, 128.0, 128.0]

    Output:
        NCHW float32 RGB tensor
    """

    resized = cv2.resize(
        image,
        INPUT_SIZE,
        interpolation=cv2.INTER_LINEAR,
    )

    rgb = cv2.cvtColor(
        resized,
        cv2.COLOR_BGR2RGB,
    )

    image_float = rgb.astype(np.float32)

    image_float = (
        image_float - np.array(
            [127.5, 127.5, 127.5],
            dtype=np.float32,
        )
    )

    image_float = image_float / np.array(
        [128.0, 128.0, 128.0],
        dtype=np.float32,
    )

    image_float = np.transpose(
        image_float,
        (2, 0, 1),
    )

    image_float = np.expand_dims(
        image_float,
        axis=0,
    )

    return image_float


def generate_anchor_centers(stride):
    """
    Generate the 2-anchor-per-location centers used
    by the exported SCRFD model.

    For example, stride 16:

        40 x 40 spatial locations
        2 anchors per location
        = 3200 predictions
    """

    feature_width = INPUT_SIZE[0] // stride
    feature_height = INPUT_SIZE[1] // stride

    centers = []

    for y in range(feature_height):
        for x in range(feature_width):

            cx = x * stride + stride / 2
            cy = y * stride + stride / 2

            # Two anchors at the same spatial location.
            centers.append([cx, cy])
            centers.append([cx, cy])

    return np.asarray(
        centers,
        dtype=np.float32,
    )


def decode_bbox(bbox, center, stride):
    """
    SCRFD bounding-box decoding.

    bbox contains:

        left
        top
        right
        bottom

    as distances from the anchor center,
    measured in units of the feature stride.
    """

    x1 = center[0] - bbox[0] * stride
    y1 = center[1] - bbox[1] * stride

    x2 = center[0] + bbox[2] * stride
    y2 = center[1] + bbox[3] * stride

    return np.array(
        [x1, y1, x2, y2],
        dtype=np.float32,
    )


def decode_keypoints(kps, center, stride):
    """
    Decode the five SCRFD facial landmarks.

    Raw format:

        x1, y1,
        x2, y2,
        x3, y3,
        x4, y4,
        x5, y5

    Values are offsets from the anchor center,
    measured in stride units.
    """

    landmarks = []

    for i in range(5):

        x = center[0] + kps[i * 2] * stride
        y = center[1] + kps[i * 2 + 1] * stride

        landmarks.append([x, y])

    return np.asarray(
        landmarks,
        dtype=np.float32,
    )


def index_to_center(index, stride):
    """
    Convert flattened prediction index to the corresponding
    anchor center.

    The model has two anchors at every spatial location.
    """

    feature_width = INPUT_SIZE[0] // stride

    location_index = index // 2

    anchor_index = index % 2

    x = location_index % feature_width
    y = location_index // feature_width

    cx = x * stride + stride / 2
    cy = y * stride + stride / 2

    return np.array(
        [cx, cy],
        dtype=np.float32,
    ), anchor_index


def main():

    print("Loading SCRFD model...")

    session = ort.InferenceSession(
        str(MODEL_PATH),
        providers=["CPUExecutionProvider"],
    )

    input_name = session.get_inputs()[0].name

    print(f"Input: {input_name}")

    print("\nLoading image...")

    image = cv2.imread(str(IMAGE_PATH))

    if image is None:
        raise FileNotFoundError(
            f"Could not read image: {IMAGE_PATH}"
        )

    original_height, original_width = image.shape[:2]

    print(
        f"Original image: "
        f"{original_width} x {original_height}"
    )

    input_tensor = preprocess(image)

    print("\nRunning inference...")

    outputs = session.run(
        None,
        {
            input_name: input_tensor,
        },
    )

    output_names = [
        output.name
        for output in session.get_outputs()
    ]

    output_map = dict(
        zip(output_names, outputs)
    )

    print("\nFinding strongest predictions...")

    results = []

    for stride in STRIDES:

        score_name = f"score_{stride}"
        bbox_name = f"bbox_{stride}"
        kps_name = f"kps_{stride}"

        scores = output_map[score_name][0, :, 0]

        best_indices = np.argsort(scores)[-5:][::-1]

        anchors = generate_anchor_centers(stride)

        for index in best_indices:

            score = float(scores[index])

            if score < CONFIDENCE_THRESHOLD:
                continue

            bbox = output_map[bbox_name][0, index]

            kps = output_map[kps_name][0, index]

            center, anchor_index = index_to_center(
                int(index),
                stride,
            )

            decoded_bbox = decode_bbox(
                bbox,
                center,
                stride,
            )

            decoded_kps = decode_keypoints(
                kps,
                center,
                stride,
            )

            results.append(
                (
                    score,
                    stride,
                    int(index),
                    anchor_index,
                    center,
                    bbox,
                    decoded_bbox,
                    decoded_kps,
                )
            )

    results.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    print("\nDecoded predictions:")

    for (
        score,
        stride,
        index,
        anchor_index,
        center,
        raw_bbox,
        decoded_bbox,
        decoded_kps,
    ) in results:

        print("\n----------------------------------------")

        print(f"Score:       {score:.6f}")
        print(f"Stride:      {stride}")
        print(f"Index:       {index}")
        print(f"Anchor:      {anchor_index}")

        print(
            "Anchor center:",
            np.round(center, 3),
        )

        print(
            "Raw bbox:",
            np.round(raw_bbox, 4),
        )

        print(
            "Decoded bbox:",
            np.round(decoded_bbox, 2),
        )

        print(
            "Decoded landmarks:"
        )

        for i, point in enumerate(decoded_kps, 1):

            print(
                f"  Point {i}: "
                f"({point[0]:.2f}, {point[1]:.2f})"
            )

        # Check whether coordinates are inside
        # the 640x640 model input.
        bbox_inside = (
            decoded_bbox[0] >= 0
            and decoded_bbox[1] >= 0
            and decoded_bbox[2] <= INPUT_SIZE[0]
            and decoded_bbox[3] <= INPUT_SIZE[1]
        )

        print(
            f"BBox inside 640x640: {bbox_inside}"
        )

        kps_inside = np.all(
            (decoded_kps >= 0)
            & (decoded_kps <= INPUT_SIZE[0])
        )

        print(
            f"Landmarks roughly inside input: "
            f"{kps_inside}"
        )


if __name__ == "__main__":
    main()