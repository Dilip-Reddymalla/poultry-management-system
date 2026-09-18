"""
Export EdgeFace PyTorch models to ONNX format.

Downloads official weights from Idiap's Hugging Face repository and exports
to standard ONNX format for onnxruntime inference.

Usage:
    python scripts/export_edgeface_onnx.py --model edgeface_s_gamma_05
    python scripts/export_edgeface_onnx.py --model edgeface_xs_gamma_06
    python scripts/export_edgeface_onnx.py --model edgeface_base
    python scripts/export_edgeface_onnx.py --all
"""

import argparse
import os
import sys
from pathlib import Path

# Ensure UTF-8 output encoding for emojis / Unicode on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import torch
from huggingface_hub import hf_hub_download

FACE_AI_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = FACE_AI_ROOT / "models" / "edgeface"

HF_REPOS = {
    "edgeface_s_gamma_05": ("Idiap/EdgeFace-S-GAMMA", "edgeface_s_gamma_05.pt"),
    "edgeface_xs_gamma_06": ("Idiap/EdgeFace-XS-GAMMA", "edgeface_xs_gamma_06.pt"),
    "edgeface_base": ("Idiap/EdgeFace-Base", "edgeface_base.pt"),
}


def export_model(model_name: str, output_dir: Path, opset_version: int = 14) -> Path:
    if model_name not in HF_REPOS:
        raise ValueError(f"Unknown model name: {model_name}")

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{model_name}.onnx"

    repo_id, pt_filename = HF_REPOS[model_name]
    print(f"Downloading/fetching checkpoint for {model_name} from Hugging Face ({repo_id})...")
    ckpt_path = hf_hub_download(repo_id=repo_id, filename=pt_filename)

    print(f"Building {model_name} architecture from torch.hub (otroshi/edgeface)...")
    # Load architecture without pretrained weights to bypass gitlab.idiap.ch timeout
    model = torch.hub.load("otroshi/edgeface", model_name, pretrained=False, trust_repo=True)

    print(f"Loading state dict from {ckpt_path}...")
    state_dict = torch.load(ckpt_path, map_location="cpu")
    model.load_state_dict(state_dict)
    model.eval()

    dummy_input = torch.randn(1, 3, 112, 112, dtype=torch.float32)

    print(f"Exporting {model_name} to {output_path} (opset {opset_version})...")
    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["embedding"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "embedding": {0: "batch_size"},
        },
    )

    print(f"✓ Exported {model_name} successfully to {output_path}")
    print(f"  File size: {output_path.stat().st_size / (1024 * 1024):.2f} MB")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Export EdgeFace models to ONNX")
    parser.add_argument(
        "--model",
        type=str,
        default="edgeface_s_gamma_05",
        choices=list(HF_REPOS.keys()),
        help="EdgeFace model variant to export",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Export all available EdgeFace models",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=14,
        help="ONNX opset version (default: 14)",
    )

    args = parser.parse_args()

    if args.all:
        for m in HF_REPOS:
            export_model(m, MODELS_DIR, args.opset)
    else:
        export_model(args.model, MODELS_DIR, args.opset)


if __name__ == "__main__":
    main()
