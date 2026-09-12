# Face AI — Multi-Face Recognition, Quality & Liveness API

Production-ready FastAPI service for multi-face detection, face quality analysis, liveness anti-spoofing, face alignment, ArcFace embedding generation, and identity matching.

---

## Pipeline Architecture

```text
HTTP Upload Image
        │
        ▼
YuNet Face Detector (OpenCV Zoo - MIT)
        │
        ├── Face 1, Face 2, Face 3, ... (Multi-Face)
        │
        ▼
Face Quality Analyzer (Qualcomm Light-FaceQ)
        │
        ├── REJECTED_LOW_QUALITY
        │
        ▼
Liveness Anti-Spoofing (Silent-Face MiniFASNetV2 - Apache-2.0)
        │
        ├── SPOOF
        │
        ▼
Face Aligner (112x112 Similarity Transform)
        │
        ▼
EdgeFace Recognizer (EdgeFace-S γ=0.5, 512-D - BSD-3-Clause)
        │
        ▼
Face Matcher (Cosine Similarity vs Reference Identities)
        │
        ├── MATCHED (identity + confidence candidates)
        └── UNKNOWN
        │
        ▼
Structured JSON Response
```

---

## Shipped Models & Commercial Licenses

| Slot | Active Model | Weight License | Code License | Commercial Ready |
|------|--------------|----------------|--------------|-------------------|
| **Detection** | **YuNet** (`face_detection_yunet_2023mar.onnx`) | **MIT** (OpenCV Zoo) | **MIT** | ✅ Yes |
| **Recognition** | **EdgeFace-S (γ=0.5)** (`edgeface_s_gamma_05.onnx`) | **BSD-3-Clause** (Idiap) | **BSD-3-Clause** | ✅ Yes (see provenance note) |
| **Liveness** | **MiniFASNetV2** (`minifasnet_v2.onnx`) | **Apache-2.0** (MiniVision) | **Apache-2.0** | ✅ Yes |
| **Quality** | **Light-FaceQ** (`face_det_lite.onnx`) | Qualcomm AI Hub Community | Permissive | ⚠️ Flagged for review |

*Note on EdgeFace Provenance*: EdgeFace code and released model weights are licensed under **BSD-3-Clause**. Training was conducted on WebFace4M/12M subsets (derived from WebFace260M research dataset).

---

## Verification & Benchmark Results (2,200 LFW Verification Pairs)

Tested identically on CPU with fixed single-thread execution:

| Metric | Baseline (SCRFD + ArcFace) | Candidate (YuNet + EdgeFace-S) | Difference / Gate |
|:---|:---:|:---:|:---:|
| **Detection Rate** | 99.97% | **100.00%** | +0.03% (Pass) |
| **Accuracy @ Best Thr** | 99.09% (thr=0.233) | **99.50%** (thr=0.376) | **+0.41%** (Pass) |
| **ROC-AUC** | 0.99495 | **0.99641** | **+0.00146** (Pass) |
| **TAR @ FAR = 1e-2** | 98.36% | **99.09%** | **+0.73%** (Pass) |
| **TAR @ FAR = 1e-3** | 97.73% | **99.00%** | **+1.27%** (Pass) |
| **Mean Genuine Similarity** | 0.5617 | **0.7160** | **+0.1543** |
| **Mean Impostor Similarity** | 0.0090 | **0.0094** | +0.0004 |
| **Separation Gap** | 0.5527 | **0.7065** | **+0.1538 (Stronger separation)** |
| **Detect Latency** | 58.13 ms | **6.78 ms** | **8.5x faster** |
| **Align Latency** | 0.51 ms | **0.47 ms** | 1.1x faster |
| **Embed Latency** | 17.45 ms | **14.07 ms** | **1.24x faster** |
| **End-to-End Latency** | 76.09 ms | **21.31 ms** | **3.57x faster (72% reduction)** |

---

## Models Included

All ONNX models are stored under `models/`:

- **YuNet Detector** (Active): `models/yunet/face_detection_yunet_2023mar.onnx`
- **EdgeFace-S Recognizer** (Active): `models/edgeface/edgeface_s_gamma_05.onnx`
- **MiniFASNetV2 Anti-Spoofing** (Active): `models/minifasnet/minifasnet_v2.onnx`
- **Light-FaceQ Quality**: `models/quality/face_det_lite.onnx`
- *Fallbacks*: `models/edgeface/edgeface_xs_gamma_06.onnx`, `models/edgeface/edgeface_base.onnx`
- *Legacy (Non-Commercial)*: `models/scrfd/scrfd_500m_bnkps.onnx`, `models/arcface/buffalo_s/w600k_mbf.onnx`, `models/liveness/modelrgb.onnx`

Models are loaded **ONCE** during FastAPI lifespan startup to maximize performance across requests.

---

## Setup Instructions

### 1. Virtual Environment & Dependencies

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Run API Server

```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Interactive Documentation

- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## API Endpoints

### 1. Health Check

```http
GET /health
```

**Response**:
```json
{
  "status": "ok",
  "service": "Face AI Service",
  "version": "1.0.0",
  "models_loaded": true
}
```

### 2. Multi-Face Image Analysis

```http
POST /api/v1/recognition/analyze
Content-Type: multipart/form-data
```

**Form Parameter**:
- `file`: Uploaded image file (JPG, PNG, WEBP)

**Sample PowerShell Request**:
```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/v1/recognition/analyze" `
  -F "file=@test_data/recognition/person1/person1_1.jpg"
```

**Sample Response**:
```json
{
  "success": true,
  "filename": "person1_1.jpg",
  "image_width": 4928,
  "image_height": 6560,
  "face_count": 2,
  "faces": [
    {
      "face_index": 1,
      "bbox": [1295.88, 2035.85, 2627.17, 3970.23],
      "detection_confidence": 0.7157,
      "landmarks": [[1744.1, 2681.9], [2326.4, 2807.2], [2032.4, 3012.8], [1709.2, 3387.7], [2200.2, 3499.9]],
      "quality": {
        "usable": true,
        "decision": "ACCEPT",
        "quality_score": 0.5284,
        "reasons": [],
        "metrics": {
          "face_width": 1331,
          "face_height": 1934,
          "face_area": 2575206.1,
          "relative_area": 0.0796,
          "detection_confidence": 0.7157,
          "sharpness": 63.33,
          "landmarks_valid": true
        }
      },
      "liveness": {
        "decision": "LIVE",
        "score": 0.9142,
        "scores": {
          "class_0": 0.0858,
          "class_1": 0.9142,
          "live": 0.9142,
          "spoof": 0.0858
        }
      },
      "recognition": {
        "status": "MATCHED",
        "identity": "person1",
        "similarity": 0.8523,
        "candidates": [
          {
            "identity": "person1",
            "similarity": 0.8523
          }
        ]
      }
    }
  ],
  "process_time_ms": 142.5
}
```

---

## Running Tests

```powershell
.venv\Scripts\python.exe tests/test_api_health.py
.venv\Scripts\python.exe tests/test_api_recognition.py
.venv\Scripts\python.exe tests/test_face_quality.py
.venv\Scripts\python.exe tests/test_real_face_matching.py
```
