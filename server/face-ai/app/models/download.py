"""Download Face-AI model binaries that are not committed to git.

The ONNX weights / sidecar data are intentionally kept out of the repository
(they are large). At startup the FastAPI application calls `ensure_models`
which downloads any missing model file from a configurable base URL
(`MODELS_DOWNLOAD_BASE_URL`).

Recommended host: **GitHub Releases** of this repo. Publish the model files as
release assets (flat filenames) and set
`MODELS_DOWNLOAD_BASE_URL=https://github.com/<owner>/<repo>/releases/download/<tag>`.
Each missing file is fetched as `<base_url>/<filename>` (assets are named by
their basename, e.g. `edgeface_s_gamma_05.onnx`).
"""

from __future__ import annotations

import logging
import urllib.request
from pathlib import Path

from app.core.config import PROJECT_ROOT, settings

logger = logging.getLogger("face_ai.models")

# Every file the production pipeline needs at boot. If a backend selector is
# changed to a legacy model (scrfd/arcface/legacy liveness), add its files here.
PRODUCTION_MODEL_FILES: list[str] = [
    "models/yunet/face_detection_yunet_2023mar.onnx",
    "models/edgeface/edgeface_s_gamma_05.onnx",
    "models/edgeface/edgeface_s_gamma_05.onnx.data",
    "models/minifasnet/minifasnet_v2.onnx",
    "models/quality/face_det_lite.onnx",
    "models/quality/face_det_lite.data",
    "models/quality/metadata.json",
]


def ensure_models() -> None:
    """Download any missing production model file from the configured base URL."""
    missing = [
        rel for rel in PRODUCTION_MODEL_FILES if not (PROJECT_ROOT / rel).exists()
    ]

    if not missing:
        return

    base_url = settings.models_download_base_url
    if not base_url:
        raise RuntimeError(
            f"{len(missing)} Face-AI model file(s) are missing and "
            "MODELS_DOWNLOAD_BASE_URL is not set. Host the model files somewhere "
            "reachable and set that env var to its base URL (files must be "
            "served under the same relative paths). Missing:\n  "
            + "\n  ".join(missing)
        )

    for rel in missing:
        dest: Path = PROJECT_ROOT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        # GitHub release assets use flat filenames, so use the basename.
        asset_name = Path(rel).name
        url = f"{base_url.rstrip('/')}/{asset_name}"
        logger.info("Downloading model file %s from %s", rel, url)
        try:
            urllib.request.urlretrieve(url, dest)
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(
                f"Failed to download model file {rel} from {url}: {exc}"
            ) from exc
        logger.info("Downloaded %s (%d bytes)", rel, dest.stat().st_size)
