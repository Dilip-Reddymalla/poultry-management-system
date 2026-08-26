# Face Recognition Architecture

This document outlines the foundation for integrating face recognition into the Poultry Management System.

## Architecture

The face recognition subsystem is decoupled from the core `Attendance` module. Instead of directly calling ML APIs in the `AttendanceService`, we define a `FaceRecognitionProvider` interface.

```
Camera (Frontend)
       ↓ (Capture frame/image)
Face Recognition Provider (Backend/External)
       ↓ (Extract embedding, match against database)
Recognized Person (Employee or Worker)
       ↓
Verify Context (Farm, Shed, Active status)
       ↓
Create Attendance Record
```

## Foundation Interfaces

See `server/src/modules/attendance/face-recognition.provider.ts` for the primary interfaces:
- `FaceEmbedding`: Represents the mathematical representation of a face.
- `FaceProfile`: Links a `FaceEmbedding` to a specific person (Employee or Worker).
- `FaceMatchResult`: The result of comparing a provided face against known profiles.
- `FaceRecognitionProvider`: The abstract service responsible for generating embeddings and finding matches.

## Privacy & Security Considerations

Biometric data is sensitive and subject to strict privacy regulations.
The following principles MUST be followed when implementing the actual ML provider:

1. **No Raw Image Storage**: The system should only store biometric templates (`FaceEmbedding`), not the raw images used to generate them. If an image is stored temporarily for auditing or onboarding, it must be encrypted and subject to a strict retention policy (e.g., deleted after 24 hours).
2. **Encryption**: `FaceEmbedding` data must be encrypted at rest in the database.
3. **Consent**: Employees and workers must provide explicit consent before their biometric data is captured or processed.
4. **Liveness Detection (Anti-Spoofing)**: The frontend or backend provider must implement liveness checks to prevent spoofing with photos or videos.
5. **Fallback Mechanism**: Manual attendance entry must ALWAYS be available as a fallback in case of recognition failures, camera issues, or user opt-out.
6. **False Matches**: The system must handle false positives gracefully. If the confidence score is below the threshold, it should require manual verification.

## Implementation Plan (Future Phase)

1. Select and integrate a Face Recognition engine (e.g., AWS Rekognition, Azure Face, or a local model like face-api.js/Python microservice).
2. Create an onboarding flow to register `FaceProfile`s for Employees and Workers.
3. Create a frontend camera component in the PWA for capturing frames and performing liveness checks.
4. Update the `POST /api/attendance` endpoint to accept an image or embedding, verify it against the `FaceRecognitionProvider`, and log the attendance.
