from pathlib import Path
import sys

import cv2
import numpy as np
import onnxruntime as ort


PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


MODEL_PATH = Path(
    "models/liveness/modelrgb.onnx"
)

IMAGE_PATH = Path(
    "test_data/recognition/person1/person1_1.jpg"
)


def softmax(x):
    x = x.astype(np.float32)
    x = x - np.max(x)
    e = np.exp(x)
    return e / np.sum(e)


def main():

    print("=" * 60)
    print("MOBILENETV3 LIVENESS MODEL INSPECTION")
    print("=" * 60)

    print("\nLoading model...")

    session = ort.InferenceSession(
        str(MODEL_PATH),
        providers=["CPUExecutionProvider"],
    )

    input_info = session.get_inputs()[0]
    output_info = session.get_outputs()[0]

    print("\nINPUT")
    print("Name:", input_info.name)
    print("Shape:", input_info.shape)
    print("Type:", input_info.type)

    print("\nOUTPUT")
    print("Name:", output_info.name)
    print("Shape:", output_info.shape)
    print("Type:", output_info.type)

    print("\nLoading image...")

    image = cv2.imread(
        str(IMAGE_PATH)
    )

    if image is None:
        raise FileNotFoundError(
            IMAGE_PATH
        )

    print(
        "Image:",
        image.shape[1],
        "x",
        image.shape[0],
    )

    # ---------------------------------------------------------
    # Temporary central crop for model inspection.
    #
    # This is NOT the final production face crop.
    # The purpose is only to inspect model output.
    # ---------------------------------------------------------

    h, w = image.shape[:2]

    size = min(h, w)

    x1 = (w - size) // 2
    y1 = (h - size) // 2

    crop = image[
        y1:y1 + size,
        x1:x1 + size,
    ]

    print(
        "\nInspection crop:",
        crop.shape[1],
        "x",
        crop.shape[0],
    )

    # ---------------------------------------------------------
    # RGB 112x112
    # ---------------------------------------------------------

    rgb = cv2.cvtColor(
        crop,
        cv2.COLOR_BGR2RGB,
    )

    resized = cv2.resize(
        rgb,
        (112, 112),
        interpolation=cv2.INTER_LINEAR,
    )

    tensor = (
        resized.astype(np.float32)
        / 255.0
    )

    tensor = np.transpose(
        tensor,
        (2, 0, 1),
    )

    tensor = np.expand_dims(
        tensor,
        axis=0,
    )

    tensor = tensor.astype(
        np.float32
    )

    print("\nTensor")
    print("Shape:", tensor.shape)
    print("Dtype:", tensor.dtype)
    print(
        "Min:",
        float(tensor.min())
    )
    print(
        "Max:",
        float(tensor.max())
    )
    print(
        "Mean:",
        float(tensor.mean())
    )

    # ---------------------------------------------------------
    # Inference
    # ---------------------------------------------------------

    output = session.run(
        [output_info.name],
        {
            input_info.name: tensor
        },
    )[0]

    print("\nRAW OUTPUT")
    print(output)

    logits = output[0]

    probabilities = softmax(
        logits
    )

    print("\nSOFTMAX")
    print(probabilities)

    predicted_class = int(
        np.argmax(probabilities)
    )

    print(
        "\nPredicted class:",
        predicted_class,
    )

    print("\n" + "=" * 60)
    print("INSPECTION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()