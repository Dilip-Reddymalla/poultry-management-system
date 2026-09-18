# PoultryOps — Enterprise Poultry Management & Biometric Suite

A full-stack industrial poultry farm management and workforce intelligence platform. Engineered with a high-performance **React 19** frontend, an **Express 5 + Prisma + PostgreSQL** core backend, and a dedicated **FastAPI Face AI** microservice running on-premise ONNX neural networks for 512-D biometric attendance and real-time operations telemetry.

---

## 🌟 Key Capabilities & Showcase Hubs

1. **Interactive Showcase & System Blueprint** ([`/about`](http://localhost:5173/about)):
   - Physics-based interactive showcase powered by **Framer Motion**.
   - Real-time interactive architecture pipeline exploring Client PWA, Security Gateway, PostgreSQL Persistence, and Biometric Neural Inference.
   - Dynamic capability explorer and technical stack specifications.

2. **Real-Time Operational Analytics** ([`/analytics`](http://localhost:5173/analytics)):
   - Public operational telemetry displaying live workforce presence ratios, shift distributions, and 7-day attendance velocity.
   - Strict **Zero-PII Privacy Protection**: aggregated metric summaries hide employee and worker identifying names.
   - Interactive data visualizations with Recharts.

3. **Ephemeral Biometric Face AI Sandbox** ([`/face-ai-demo`](http://localhost:5173/face-ai-demo)):
   - Browser-based neural network sandbox allowing visitors and recruiters to test facial registration and sub-15ms recognition.
   - **Zero Cloud Storage / Zero DB Persistence**: Face embeddings exist in an in-memory TTL store that automatically self-destructs after 10 minutes.
   - Camera video stream and image file upload support.

4. **Farm & Shed Hierarchy Operations**:
   - Multi-tier relational tree linking Companies → Farms → Sheds → Workers.
   - Shed flock capacity tracking, status state-machine (`AVAILABLE`, `MAINTENANCE`, `INACTIVE`), and automated assignment verification.

5. **Workforce Attendance & Shift Management**:
   - Shift-based scheduling (`MORNING_SHIFT`, `AFTERNOON_SHIFT`, `NIGHT_SHIFT`, `OVERTIME`).
   - Contactless Face AI attendance with anti-spoofing liveness checks.
   - Fallback GPS geolocation logging, duplicate prevention, and Excel spreadsheet exports for accountants.

6. **Enterprise Security & Compliance**:
   - Granular Role-Based Access Control (RBAC) resolved per request (DGM, Assistant Manager, Super Incharge, Incharge, Supervisor, Accountant).
   - HTTP-only JWT cookies with server-side session revocation.
   - Tamper-resistant immutable audit logs recording all state mutations.
   - Multi-tier rate limiting protecting public demo endpoints and internal gateways.

---

## 🧠 Biometric Face AI Suite

The biometric subsystem runs optimized ONNX models with 512-dimensional ArcFace vector extraction:

| Component | Model | Architecture / Provenance | Dimension / Latency |
|---|---|---|---|
| **Face Detection** | **YuNet** | OpenCV Zoo (`face_detection_yunet_2023mar.onnx`) | Multi-face, 6.78 ms |
| **Quality Filter** | **Light-FaceQ** | Qualcomm AI Hub (`face_det_lite.onnx`) | Illumination & Blur gate |
| **Liveness Anti-Spoofing** | **MiniFASNetV2** | MiniVision (`minifasnet_v2.onnx`) | Photo & Screen defense |
| **Face Alignment** | **5-Point Affine** | Similarity Transform | 112×112 standardized crop |
| **Face Recognition** | **EdgeFace-S (γ=0.5)** | Idiap Research (`edgeface_s_gamma_05.onnx`) | **512-D** ArcFace, 14.07 ms |
| **Vector Matching** | **Cosine & Euclidean** | In-Memory & pgvector ready | **< 15 ms** comparison |

*All ONNX model weights are preserved and tracked in git under `server/face-ai/models/`.*

---

## 🏗️ Project Structure

```text
poultry-management-system/
├── client/                     # Vite + React 19 + TypeScript frontend
│   ├── src/
│   │   ├── features/about/     # Interactive About page (Framer Motion)
│   │   ├── features/analytics/ # Public operations telemetry dashboard
│   │   ├── features/face-ai/   # Ephemeral Face AI demo sandbox
│   │   ├── features/attendance/# Shift attendance & facial recognition UI
│   │   ├── layout/             # Responsive shell & navigation
│   │   └── pwa/                # Installable Progressive Web App
├── server/                     # Express 5 + TypeScript + Prisma API
│   ├── src/
│   │   ├── modules/analytics/  # Public Zero-PII telemetry service
│   │   ├── modules/face-ai/    # Ephemeral 10m TTL store & Face-AI proxy
│   │   ├── modules/attendance/ # Attendance CRUD, shifts, GPS, Excel export
│   │   └── middlewares/        # Scoped RBAC, CORS headers, rate limits
│   └── prisma/                 # PostgreSQL schema, migrations, and seeds
├── server/face-ai/             # FastAPI + ONNX Runtime Python microservice
│   ├── app/                    # Multi-face detection, liveness & recognition
│   └── models/                 # Shipped ONNX model weights (YuNet, EdgeFace)
├── docs/                       # Architecture diagrams & technical specifications
└── docker-compose.yml          # PostgreSQL 17 development service
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+
- **Python**: v3.10+ (for Face AI microservice)
- **Docker**: For local PostgreSQL database

### 2. Database Setup
Start the local PostgreSQL 17 container:
```bash
docker compose up -d
```

### 3. Server Configuration & Migration
```bash
cd server
cp .env.example .env
npm install
npx prisma migrate dev
npm run seed
```

### 4. Client Setup
```bash
cd ../client
cp .env.example .env
npm install
```

### 5. Running the Application
In separate terminal tabs:

**Backend API & Face AI Proxy**:
```bash
cd server
npm run dev
```
*(Runs Express on `http://localhost:5000` and launches Face AI service on `http://localhost:8000`)*

**Frontend Application**:
```bash
cd client
npm run dev
```
*(Runs Vite client on `http://localhost:5173`)*

---

## 🧪 Testing & Verification

Run the integration and unit test suites:

```bash
# Test Express API, Scoped RBAC, Analytics, and Face AI Proxy
cd server
npm run test

# Typecheck TypeScript across client and server
cd client && npm run typecheck
cd ../server && npm run typecheck
```

---

## 🔒 Security & Privacy Guarantees

- **No Raw Biometric Storage**: Images uploaded to the Face AI engine are converted to mathematical embeddings in volatile memory; raw images are never written to disk or third-party cloud storage.
- **Ephemeral Sandbox Sessions**: Demo visitors receive a self-cleaning session where face embeddings are held exclusively in RAM and deleted after 10 minutes.
- **HttpOnly Cookie Authentication**: JWT access tokens are inaccessible to browser JavaScript, mitigating XSS token theft.
- **Rate-Limited Gateways**: Public demo endpoints enforce strict request limits per minute (60 req/min authenticated, 20 req/min public).

---

## 📜 License & Acknowledgments

Engineered as an enterprise poultry infrastructure and biometric showcase project.
Models: **YuNet** (MIT - OpenCV Zoo), **EdgeFace** (BSD-3-Clause - Idiap), **MiniFASNet** (Apache-2.0 - MiniVision).
