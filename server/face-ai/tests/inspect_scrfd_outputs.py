from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


BASE_DIR = Path(__file__).resolve().parents[1]

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "scrfd"
    / "scrfd_500m_bnkps.onnx"
)

IMAGE_PATH = (
    BASE_DIR
    / "test_data"
    / "test.jpg"
)


def main():

    print("Loading SCRFD model...")

    session = ort.InferenceSession(
        str(MODEL_PATH),
        providers=["CPUExecutionProvider"],
    )

    print("\nModel inputs:")

    for item in session.get_inputs():
        print(
            f"  {item.name}: "
            f"shape={item.shape}, "
            f"type={item.type}"
        )

    print("\nModel outputs:")

    for item in session.get_outputs():
        print(
            f"  {item.name}: "
            f"shape={item.shape}, "
            f"type={item.type}"
        )

    print("\nLoading image...")

    image = cv2.imread(
        str(IMAGE_PATH)
    )

    if image is None:
        raise FileNotFoundError(
            f"Could not read image: {IMAGE_PATH}"
        )

    print(
        f"Original image shape: "
        f"{image.shape}"
    )

    # SCRFD input.
    image_rgb = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2RGB,
    )

    image_resized = cv2.resize(
        image_rgb,
        (640, 640),
    )

    image_resized = (
        image_resized.astype(
            np.float32
        )
    )

    image_resized = (
        image_resized - 127.5
    ) / 128.0

    image_resized = np.transpose(
        image_resized,
        (2, 0, 1),
    )

    input_tensor = np.expand_dims(
        image_resized,
        axis=0,
    ).astype(np.float32)

    input_name = (
        session.get_inputs()[0].name
    )

    print(
        f"\nRunning inference using "
        f"input: {input_name}"
    )

    outputs = session.run(
        None,
        {
            input_name: input_tensor
        },
    )

    print("\nActual output shapes:")

    for metadata, value in zip(
        session.get_outputs(),
        outputs,
    ):
        print(
            f"  {metadata.name}: "
            f"{value.shape}"
        )

    print("\nExpected output sizes:")

    print("  stride 8 : 80 × 80 = 6400")
    print("  stride 16: 40 × 40 = 1600")
    print("  stride 32: 20 × 20 = 400")


if __name__ == "__main__":
    main()