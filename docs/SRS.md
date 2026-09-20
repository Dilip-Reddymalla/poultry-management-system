# Software Requirements Specification (SRS)
## PoultryOps — Enterprise Poultry Management & Biometric Suite

**Document Version:** 1.0.0  
**Status:** Approved / Production Baseline  
**Author:** Dilip Reddymalla (Lead / Solo Developer)  
**Standard:** Compliant with IEEE 830 / ISO/IEC/IEEE 29148 Standard  
**Date:** September 2026  

---

### Table of Contents
1. [Introduction](#1-introduction)
   - 1.1 Purpose
   - 1.2 Document Conventions
   - 1.3 Intended Audience
   - 1.4 Product Scope
   - 1.5 References
2. [Overall Description](#2-overall-description)
   - 2.1 Product Perspective & System Architecture
   - 2.2 Product Functions
   - 2.3 User Classes and Personas
   - 2.4 Operating Environment
   - 2.5 Design and Implementation Constraints
   - 2.6 Assumptions and Dependencies
3. [System Features and Functional Requirements](#3-system-features-and-functional-requirements)
   - 3.1 Authentication, Multi-Tenant Hierarchy & RBAC
   - 3.2 Farm & Shed Infrastructure Management
   - 3.3 Workforce Management (Employees vs. Workers)
   - 3.4 Contactless Biometric Attendance & Shift Management
   - 3.5 On-Premise Face AI Neural Subsystem & Ephemeral Sandbox
   - 3.6 Real-Time Operational Analytics & Zero-PII Telemetry
   - 3.7 Immutable Audit Logging & Compliance
   - 3.8 Data Export & Financial Reconciliation
4. [External Interface Requirements](#4-external-interface-requirements)
   - 4.1 User Interfaces
   - 4.2 Hardware & Camera Interfaces
   - 4.3 Software Interfaces & Microservices
   - 4.4 Communications Interfaces
5. [Non-Functional Requirements (NFRs)](#5-non-functional-requirements-nfrs)
   - 5.1 Performance Requirements
   - 5.2 Security & Cryptographic Requirements
   - 5.3 Privacy & Biometric Data Governance (DPDP / GDPR)
   - 5.4 Software Quality Attributes (Reliability, Availability, Maintainability)
6. [Data Model & Database Design](#6-data-model--database-design)
7. [Appendix & Acronyms](#7-appendix--acronyms)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) specifies the functional, non-functional, interface, and architectural requirements for **PoultryOps** — an enterprise-grade Poultry Farm Management, Workforce Intelligence, and Edge Biometric Attendance Suite. 

### 1.2 Document Conventions
- **MUST / SHALL**: Mandatory requirement.
- **SHOULD**: High-priority recommendation.
- **MAY**: Optional capability.
- Requirement Identifiers follow the format `[REQ-MODULE-XXX]`.

### 1.3 Intended Audience
This document is designed for enterprise poultry conglomerate stakeholders, farm operations directors, enterprise software clients, auditing bodies, and engineering teams.

### 1.4 Product Scope
PoultryOps addresses acute enterprise poultry operational challenges:
- High employee and contractual worker turnover across distributed rural farms.
- "Buddy punching" and manual attendance fraud in remote sheds.
- Lack of low-latency biometric recognition in intermittent connectivity environments.
- Complex hierarchical delegation (Holding Companies → Industrial Farms → Individual Sheds).
- Regulatory compliance mandates prohibiting long-term raw facial imagery storage.

### 1.5 References
- IEEE Std 830-1998: IEEE Recommended Practice for Software Requirements Specifications.
- ISO/IEC 19794-5: Biometric data interchange formats — Face image data.
- Digital Personal Data Protection (DPDP) Act & EU GDPR Article 9 (Special category biometric data).
- OpenCV Zoo YuNet & Idiap Research EdgeFace-S Technical Papers.

---

## 2. Overall Description

### 2.1 Product Perspective & System Architecture
PoultryOps operates as a distributed, decoupled multi-tier enterprise platform:

```
[ Edge PWA Client (React 19 + TypeScript + Vite) ]
                    │
                    ▼  (HTTPS / Secure Cookie JWT)
[ Core API Gateway (Node.js Express 5 + TypeScript) ]
       │                                     │
       ▼ (Prisma ORM / SQL)                 ▼ (REST / gRPC-ready)
[ PostgreSQL 17 + pgvector ]     [ Face AI Microservice (FastAPI + ONNX Runtime) ]
                                 ├── YuNet Face Detector (6.78ms)
                                 ├── MiniFASNetV2 Anti-Spoofing (Liveness)
                                 ├── Light-FaceQ Quality Gate
                                 └── EdgeFace-S 512-D Embedding Extractor (14.07ms)
```

### 2.2 Product Functions
- **Hierarchical Asset Hierarchy:** Multi-company, multi-farm, multi-shed capacity allocation.
- **Separated Workforce Registry:** Clear structural separation between authenticated managerial staff (`Employees`/`Users`) and non-credentialed field laborers (`Workers`).
- **Contactless Biometric Attendance:** Sub-second face recognition powered by local ONNX edge inference with anti-spoofing liveness checks and GPS geofence stamping.
- **Ephemeral Sandbox Environment:** Demonstration and onboarding suite operating an in-memory 10-minute TTL biometric cache without cloud database writes.
- **Telemetry & Zero-PII Dashboards:** Aggregate workforce velocity, shift distributions, and shed capacity utilization.
- **Audit Logging:** Tamper-resistant immutable trace logs recording state transitions and actor coordinates.

### 2.3 User Classes and Personas
| Role | Scope Level | Responsibilities |
|---|---|---|
| **System Admin** | Global (Env/Super) | Full infrastructure, tenant provisioning, system maintenance. |
| **Deputy General Manager (DGM)** | Company | Multi-farm operational analytics, attendance approvals, executive reporting. |
| **Assistant Manager** | Company / Farm | Farm allocation, shed status transition, worker transfer approvals. |
| **Super Incharge** | Multi-Farm | Cross-farm workforce distribution and shift roster management. |
| **Incharge / Supervisor** | Farm | Daily shift attendance marking, facial enrollment, shed assignment. |
| **Accountant** | Company | Financial reconciliation, attendance exports (XLSX), payroll readiness. |
| **Field Worker** | Physical Shed | Uncredentialed subject of attendance and task assignment. |

### 2.4 Operating Environment
- **Client:** Modern Chromium, Safari, or Firefox browser; iOS/Android PWA support. Camera access (WebRTC `getUserMedia`) and HTML5 Geolocation API mandatory for biometric check-in.
- **Core Server:** Node.js v20+ LTS, Express 5, Prisma 6.
- **Face AI Engine:** Python 3.10+, ONNX Runtime 1.17+, OpenCV Headless, NumPy.
- **Database:** PostgreSQL 17 with `pgvector` extension enabled for 512-dimensional vector similarity search.
- **Containerization:** Docker Compose multi-service topology.

---

## 3. System Features and Functional Requirements

### 3.1 Authentication, Multi-Tenant Hierarchy & RBAC
- `[REQ-AUTH-001]`: The system SHALL authenticate employees using email/password or mobile phone OTP challenges.
- `[REQ-AUTH-002]`: Refresh tokens and session tokens SHALL be issued as `HttpOnly`, `SameSite=Strict`, `Secure` cookies to prevent client-side script exfiltration.
- `[REQ-AUTH-003]`: When creating an employee login with an assigned role, if an initial password is not assigned during creation, the account SHALL be flagged with `mustSetPassword = true`. Such accounts SHALL be restricted upon first login (e.g., via OTP) to force password creation before gaining access to operational routes.
- `[REQ-AUTH-004]`: Access control SHALL enforce granular Scope Levels (`GLOBAL`, `COMPANY`, `FARM`). Users assigned to Farm A SHALL NOT read or write records of Farm B.
- `[REQ-AUTH-005]`: The system SHALL support dynamic role-permission mappings cached in memory with automatic revocation upon role assignment mutation.

### 3.2 Farm & Shed Infrastructure Management
- `[REQ-FARM-001]`: The system SHALL maintain a strict parent-child relationship: `Company` → `Farm` → `Shed`.
- `[REQ-FARM-002]`: Each shed SHALL track bird holding capacity and operational status: `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, `INACTIVE`.
- `[REQ-FARM-003]`: The system SHALL prevent shed status transition to `AVAILABLE` if active poultry batches or un-cleared maintenance tasks exist.

### 3.3 Workforce Management
- `[REQ-WRK-001]`: The system SHALL maintain distinct entities for `Employee` (credentialed staff) and `Worker` (contractual labor without system login).
- `[REQ-WRK-002]`: Every worker and employee SHALL be assigned to a specific primary `Farm`.
- `[REQ-WRK-003]`: The system SHALL support registering a 512-dimensional normalized facial embedding vector against an employee or worker profile.

### 3.4 Contactless Biometric Attendance & Shift Management
- `[REQ-ATT-001]`: The system SHALL support predefined shifts: `MORNING_SHIFT`, `AFTERNOON_SHIFT`, `NIGHT_SHIFT`, and `OVERTIME`.
- `[REQ-ATT-002]`: Attendance records SHALL enforce uniqueness per person (either `employeeId` OR `workerId`), per calendar `date`, per `shift`.
- `[REQ-ATT-003]`: Biometric attendance SHALL capture:
  - Latitude and Longitude (client-side GPS lock required).
  - Mode of verification (`FACE_AI` vs `MANUAL`).
  - Liveness verification score (MiniFASNet threshold >= 0.70).
  - Confidence matching score (Cosine similarity threshold >= 0.65).
  - Optional snapshot storage via secure CDN/Cloudinary.
- `[REQ-ATT-004]`: The system SHALL support an approval workflow where recorded attendance remains unfinalized until approved by an Incharge/DGM (`approvedById`, `approvedAt`).

### 3.5 On-Premise Face AI Neural Subsystem & Ephemeral Sandbox
- `[REQ-FAI-001]`: The Face AI service SHALL perform inference entirely on-premise without reliance on external cloud computer vision APIs (Zero AWS/Azure face lock-in).
- `[REQ-FAI-002]`: Face detection SHALL utilize YuNet ONNX with inference latency under 10ms.
- `[REQ-FAI-003]`: The system SHALL execute anti-spoofing liveness detection to reject printed photographs, tablet screens, and cutout masks.
- `[REQ-FAI-004]`: The feature extractor SHALL output a L2-normalized 512-dimensional vector using EdgeFace-S architecture.
- `[REQ-FAI-005]`: The system SHALL offer a public Ephemeral Demo Sandbox (`/face-ai-demo`) maintaining session embeddings exclusively in RAM with a 10-minute Time-To-Live (TTL) auto-destruction policy.

### 3.6 Real-Time Operational Analytics & Zero-PII Telemetry
- `[REQ-ANA-001]`: The system SHALL compute aggregated daily attendance velocity, shift distribution ratios, and farm capacity utilization.
- `[REQ-ANA-002]`: Publicly exposed analytics endpoints SHALL strictly enforce Zero Personally Identifiable Information (Zero-PII), exposing only anonymized cluster counts and percentages.

### 3.7 Immutable Audit Logging & Compliance
- `[REQ-AUD-001]`: Every state-mutating operation (`CREATE`, `UPDATE`, `DELETE`) on master records SHALL generate an immutable `AuditLog` entry.
- `[REQ-AUD-002]`: Audit logs SHALL record timestamp, actor ID, actor role, source IP, user agent, entity name, and JSON delta (`before` / `after`).

### 3.8 Data Export & Financial Reconciliation
- `[REQ-EXP-001]`: The system SHALL generate Excel spreadsheets (`.xlsx`) formatted for enterprise payroll systems, including shift hours, present days, overtime tallies, and supervisor sign-offs.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
- **Responsive Web & PWA:** Mobile-first responsive UI built with React 19, CSS design tokens, and Framer Motion micro-interactions.
- **Biometric Viewport:** High-contrast camera viewport with real-time face bounding box overlays and dynamic liveness status indicators.

### 4.2 Hardware & Camera Interfaces
- Standard UVC USB cameras, integrated smartphone webcams, and ruggedized Android tablets running standard browser WebRTC video streams (`640x480` to `1920x1080` resolution).

### 4.3 Software Interfaces
- **Express 5 Core Backend** exposes RESTful endpoints at `/api/v1/*`.
- **FastAPI Face AI Service** communicates over internal HTTP at `http://localhost:8000/*` with payload validation via Pydantic.
- **PostgreSQL 17** connection pool managed via Prisma Client with raw SQL extensions for `vector(512)` cosine distance operations (`<=>`).

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Performance Requirements
| Metric | Threshold |
|---|---|
| Face Detection Latency (YuNet) | < 10 ms |
| Face Feature Extraction (EdgeFace-S) | < 25 ms |
| Vector Comparison (pgvector / In-Memory) | < 15 ms |
| End-to-End Biometric Check-In Turnaround | < 800 ms |
| Core API Route Latency (p95) | < 120 ms |
| Client Initial Paint (FCP) | < 1.2 s |

### 5.2 Security Requirements
- Passwords hashed using `bcrypt` (work factor 12) or `argon2id`.
- Rate limiting:
  - Public demo endpoints: 20 req/minute per IP.
  - Authenticated API routes: 120 req/minute per IP.
  - Biometric verification: 30 req/minute per farm terminal.
- Strict Cross-Origin Resource Sharing (CORS) with origin validation.

### 5.3 Privacy & Biometric Data Governance
- **Zero Raw Image Persistence:** Raw camera frames are analyzed in volatile memory and discarded immediately.
- Only non-invertible 512-D mathematical embeddings are persisted.
- Biometric records are protected by farm-level isolation preventing cross-tenant vector scanning.

---

## 6. Data Model & Entity Relations
The relational schema comprises:
- `Company` (1) ───< `Farm` (N)
- `Farm` (1) ───< `Shed` (N)
- `Farm` (1) ───< `Employee` (N) ─── (0..1) `User` ───< `UserRole` >─── (1) `Role`
- `Farm` (1) ───< `Worker` (N)
- `Attendance` (N) ─── linked to `Farm`, `Shed`, `Employee` (opt), `Worker` (opt), `User` (Recorder & Approver)
- `AuditLog` (N) ─── append-only temporal ledger.
- `OtpChallenge` (N) ─── ephemeral authentication store.

---

## 7. Sign-off & Revision Matrix
- **Document Version:** 1.0.0
- **Prepared By:** Dilip Reddymalla
- **Architectural Review:** PASSED
- **Security Audit:** COMPLIANT (Zero-PII & Biometric Safe)
