from pathlib import Path

import onnxruntime as ort


MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "models"
    / "scrfd"
    / "scrfd_500m_bnkps.onnx"
)


def main():
    print("Checking SCRFD model...")
    print(f"Model path: {MODEL_PATH}")

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"SCRFD model not found: {MODEL_PATH}"
        )

    print(f"Model size: {MODEL_PATH.stat().st_size / (1024 * 1024):.2f} MB")

    session = ort.InferenceSession(
        str(MODEL_PATH),
        providers=["CPUExecutionProvider"],
    )

    print("\nModel loaded successfully!")

    print("\nInput(s):")

    for input_tensor in session.get_inputs():
        print(
            f"  name={input_tensor.name}, "
            f"shape={input_tensor.shape}, "
            f"type={input_tensor.type}"
        )

    print("\nOutput(s):")

    for output_tensor in session.get_outputs():
        print(
            f"  name={output_tensor.name}, "
            f"shape={output_tensor.shape}, "
            f"type={output_tensor.type}"
        )

    print("\nAvailable providers:")
    print(session.get_providers())


if __name__ == "__main__":
    main()