"""
Inspection script for the Light-FaceQ / face_det_lite quality model.
"""

from __future__ import annotations

import sys
from pathlib import Path
import json

import onnxruntime as ort

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "models" / "quality" / "face_det_lite.onnx"
METADATA_PATH = PROJECT_ROOT / "models" / "quality" / "metadata.json"


def main():
    print("=" * 60)
    print("FACE QUALITY MODEL INSPECTION")
    print("=" * 60)

    print(f"\nMODEL\nPath: {MODEL_PATH}")

    if not MODEL_PATH.exists():
        print("ERROR: Model path does not exist!")
        return

    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])

    print("\nINPUTS")
    for inp in session.get_inputs():
        print(f"Name:  {inp.name}")
        print(f"Shape: {inp.shape}")
        print(f"Type:  {inp.type}")

    print("\nOUTPUTS")
    for out in session.get_outputs():
        print(f"Name:  {out.name}")
        print(f"Shape: {out.shape}")
        print(f"Type:  {out.type}")

    print("\nMETADATA")
    meta = session.get_modelmeta()
    print(f"Producer: {meta.producer_name}")
    print(f"Version:  {meta.version}")
    print(f"Domain:   {meta.domain}")
    print(f"Description: {meta.description}")
    if meta.custom_metadata_map:
        print("Custom Metadata Map:")
        for k, v in meta.custom_metadata_map.items():
            print(f"  {k}: {v}")
    
    if METADATA_PATH.exists():
        print("\nACCOMPANYING METADATA.JSON")
        try:
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                meta_json = json.load(f)
            print(json.dumps(meta_json, indent=2))
        except Exception as e:
            print(f"Failed to read metadata.json: {e}")

    print("\nPROVIDERS")
    print(session.get_providers())

    print("\n=" * 60)
    print("INSPECTION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
