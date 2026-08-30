from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


MODEL_PATH = Path("models/scrfd/scrfd_500m_bnkps.onnx")
IMAGE_PATH = Path("test_data/test.jpg")

INPUT_SIZE = (640, 640)


def print_stats(name, array):
    array = np.asarray(array)

    print(f"\n{name}")
    print(f"  Shape: {array.shape}")
    print(f"  Min:   {array.min():.6f}")
    print(f"  Max:   {array.max():.6f}")
    print(f"  Mean:  {array.mean():.6f}")
    print(f"  Std:   {array.std():.6f}")


def preprocess(image):
    """
    SCRFD preprocessing based on the model configuration:

        mean = [127.5, 127.5, 127.5]
        std  = [128.0, 128.0, 128.0]

    The model expects:
        NCHW
        float32
        RGB
    """

    resized = cv2.resize(
        image,
        INPUT_SIZE,
        interpolation=cv2.INTER_LINEAR,
    )

    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

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


def main():

    print("Loading SCRFD model...")

    session = ort.InferenceSession(
        str(MODEL_PATH),
        providers=["CPUExecutionProvider"],
    )

    input_name = session.get_inputs()[0].name

    print(f"Input name: {input_name}")

    print("\nLoading image...")

    image = cv2.imread(str(IMAGE_PATH))

    if image is None:
        raise FileNotFoundError(
            f"Could not read image: {IMAGE_PATH}"
        )

    print(f"Original image shape: {image.shape}")

    input_tensor = preprocess(image)

    print(f"Input tensor shape: {input_tensor.shape}")
    print(f"Input tensor dtype: {input_tensor.dtype}")

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

    print("\nRaw output statistics:")

    # Scores
    for name in [
        "score_8",
        "score_16",
        "score_32",
    ]:
        print_stats(
            name,
            output_map[name],
        )

    # Bounding boxes
    for name in [
        "bbox_8",
        "bbox_16",
        "bbox_32",
    ]:
        print_stats(
            name,
            output_map[name],
        )

    # Keypoints
    for name in [
        "kps_8",
        "kps_16",
        "kps_32",
    ]:
        print_stats(
            name,
            output_map[name],
        )

    print("\nTop score predictions:")

    for name in [
        "score_8",
        "score_16",
        "score_32",
    ]:
        scores = output_map[name][0, :, 0]

        top_indices = np.argsort(scores)[-10:][::-1]

        print(f"\n{name}")

        for index in top_indices:
            print(
                f"  index={index:5d} "
                f"score={scores[index]:.6f}"
            )

    print("\nRaw values for highest-confidence predictions:")

    for score_name, bbox_name, kps_name in [
        ("score_8", "bbox_8", "kps_8"),
        ("score_16", "bbox_16", "kps_16"),
        ("score_32", "bbox_32", "kps_32"),
    ]:

        scores = output_map[score_name][0, :, 0]

        best_index = int(
            np.argmax(scores)
        )

        bbox = output_map[bbox_name][0, best_index]
        kps = output_map[kps_name][0, best_index]

        print(f"\n{score_name}")
        print(f"  Best index: {best_index}")
        print(f"  Score: {scores[best_index]:.6f}")
        print(f"  BBox raw: {bbox}")
        print(f"  KPS raw:  {kps}")


if __name__ == "__main__":
    main()