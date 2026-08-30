# Face AI — Multi-Face Recognition, Quality & Liveness API

Production-ready FastAPI service for multi-face detection, face quality analysis, liveness anti-spoofing, face alignment, ArcFace embedding generation, and identity matching.

---

## Pipeline Architecture

```text
HTTP Upload Image
        │
        ▼
SCRFD Face Detector (500M)
        │
        ├── Face 1, Face 2, Face 3, ... (Multi-Face)
        │
        ▼
Face Quality Analyzer (Qualcomm Light-FaceQ)
        │
        ├── REJECTED_LOW_QUALITY
        │
        ▼
Liveness Analyzer (Tencent YouTu modelrgb)
        │
        ├── SPOOF
        │
        ▼
Face Aligner (112x112 Similarity Transform)
        │
        ▼
ArcFace Recognizer (MobileFaceNet 512-D)
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

## Models Included

All ONNX models are stored under `models/`:

- **SCRFD Detector**: `models/scrfd/scrfd_500m_bnkps.onnx`
- **Light-FaceQ Quality**: `models/quality/face_det_lite.onnx`
- **Liveness Anti-Spoofing**: `models/liveness/modelrgb.onnx`
- **ArcFace Embedding**: `models/arcface/buffalo_s/w600k_mbf.onnx`

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
