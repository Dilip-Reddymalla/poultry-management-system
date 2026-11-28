#!/usr/bin/env bash
# Publishes the Face-AI model binaries as GitHub Release assets.
#
# The model weights are intentionally NOT committed to git. Upload them as
# release assets instead, then point the microservice at them via
#   MODELS_DOWNLOAD_BASE_URL=https://github.com/<owner>/<repo>/releases/download/<tag>
#
# Usage (requires the GitHub CLI `gh` and a token with release scope):
#   bash scripts/publish-models.sh [tag]      # default tag: models-v1
set -euo pipefail

TAG="${1:-models-v1}"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/models"

MODELS=(
  "yunet/face_detection_yunet_2023mar.onnx"
  "edgeface/edgeface_s_gamma_05.onnx"
  "edgeface/edgeface_s_gamma_05.onnx.data"
  "minifasnet/minifasnet_v2.onnx"
  "quality/face_det_lite.onnx"
  "quality/face_det_lite.data"
  "quality/metadata.json"
)

echo "Publishing models to ${REPO} release ${TAG} (from ${DIR})"

# Create the release (best-effort — ignore failure if it already exists).
gh release create "$TAG" --repo "$REPO" \
  --title "Face-AI Models $TAG" \
  --notes "ONNX model weights for the Face-AI microservice." \
  || echo "Note: release may already exist; continuing to upload assets."

for rel in "${MODELS[@]}"; do
  asset="$DIR/$rel"
  if [[ ! -f "$asset" ]]; then
    echo "!! missing asset: $asset" >&2
    exit 1
  fi
  echo "Uploading $(basename "$asset")"
  gh release upload "$TAG" "$asset" --repo "$REPO" --clobber
done

echo ""
echo "Done. In Railway, set:"
echo "  MODELS_DOWNLOAD_BASE_URL=https://github.com/${REPO}/releases/download/${TAG}"
