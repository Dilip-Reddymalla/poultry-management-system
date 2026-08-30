import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { analyzeImage, type FaceAIFaceResult } from "../../services/face-ai.service.js";
import {
  searchByEmbedding,
  type CandidateMatch,
} from "../../services/vector-search.service.js";
import type { AuthScope } from "../auth/scope.js";
import { assertFarmWritable, farmScopedWhere } from "../auth/scope.js";
import type { BulkMarkFaceAttendanceInput } from "./face-attendance.schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessedFace {
  faceIndex: number;
  bbox: number[];
  /** LIVE | SPOOF | REJECTED_LOW_QUALITY */
  status: string;
  qualityScore: number | null;
  livenessScore: number | null;
  candidates: CandidateMatch[];
}

export interface FrameProcessResult {
  imageWidth: number;
  imageHeight: number;
  faceCount: number;
  faces: ProcessedFace[];
  processTimeMs: number;
  /** Cloudinary URL of the uploaded snapshot (for audit trail). */
  snapshotUrl: string | null;
}

export interface BulkMarkResult {
  markedCount: number;
  duplicateCount: number;
  errors: Array<{ index: number; reason: string }>;
}

// ---------------------------------------------------------------------------
// Process Frame
// ---------------------------------------------------------------------------

/**
 * Process a camera frame / photo through the Face AI pipeline and run pgvector
 * similarity search for each valid face.
 */
export async function processFrame(
  imageBuffer: Buffer,
  filename: string,
  farmId: string,
  scope: AuthScope,
): Promise<FrameProcessResult> {
  // Verify the caller has access to the target farm.
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true },
  });

  if (!farm) {
    throw new AppError("Farm not found", 404);
  }

  assertFarmWritable(scope, farm);

  // 1. Send image to FastAPI for face detection, quality, liveness, and embedding.
  const aiResult = await analyzeImage(imageBuffer, filename);

  // 2. For each detected face, run pgvector search if embedding is available.
  const faces: ProcessedFace[] = [];

  for (const face of aiResult.faces) {
    const status = deriveFaceStatus(face);
    const qualityScore = face.quality?.quality_score ?? null;
    const livenessScore = face.liveness?.score ?? null;

    let candidates: CandidateMatch[] = [];

    if (face.embedding && status === "LIVE") {
      candidates = await searchByEmbedding(face.embedding, {
        threshold: 0.40,
        limit: 5,
        farmId,
      });
    }

    faces.push({
      faceIndex: face.face_index,
      bbox: face.bbox,
      status,
      qualityScore,
      livenessScore,
      candidates,
    });
  }

  return {
    imageWidth: aiResult.image_width,
    imageHeight: aiResult.image_height,
    faceCount: aiResult.face_count,
    faces,
    processTimeMs: aiResult.process_time_ms,
    snapshotUrl: null,
  };
}

function deriveFaceStatus(face: FaceAIFaceResult): string {
  if (!face.quality.usable) return "REJECTED_LOW_QUALITY";
  if (face.liveness && face.liveness.decision === "SPOOF") return "SPOOF";
  return "LIVE";
}

// ---------------------------------------------------------------------------
// Bulk Mark Face Attendance
// ---------------------------------------------------------------------------

/**
 * Insert attendance records for faces confirmed by the operator.
 * Uses the existing attendance table with face-AI verification fields.
 */
export async function bulkMarkFaceAttendance(
  scope: AuthScope,
  input: BulkMarkFaceAttendanceInput,
): Promise<BulkMarkResult> {
  let markedCount = 0;
  let duplicateCount = 0;
  const errors: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < input.records.length; i++) {
    const record = input.records[i];
    if (!record) continue;

    try {
      // Determine which person type and resolve their farm.
      const personLink = record.employeeId
        ? { employeeId: record.employeeId }
        : { workerId: record.workerId! };

      // Resolve the person's farm and validate write access.
      const personType = record.employeeId ? "employee" : "worker";
      const person = await (prisma as any)[personType].findUnique({
        where: { id: record.employeeId ?? record.workerId! },
        select: { id: true, status: true, farmId: true, farm: { select: { companyId: true } } },
      });

      if (!person) {
        errors.push({ index: i, reason: `${personType} not found` });
        continue;
      }

      if (person.status !== "ACTIVE") {
        errors.push({ index: i, reason: `${personType} is inactive` });
        continue;
      }

      assertFarmWritable(scope, {
        companyId: person.farm.companyId,
        id: person.farmId,
      });

      await prisma.attendance.create({
        data: {
          date: record.date,
          farmId: person.farmId,
          shedId: record.shedId ?? null,
          ...personLink,
          shift: record.shift,
          status: record.status,
          latitude: record.latitude,
          longitude: record.longitude,
          verificationMode: "FACE_AI",
          livenessScore: record.livenessScore ?? null,
          qualityScore: record.qualityScore ?? null,
          confidenceScore: record.confidenceScore ?? null,
          snapshotUrl: record.snapshotUrl ?? null,
          notes: record.notes ?? null,
          recordedById: scope.userId,
          approvedById: scope.userId,
          approvedAt: new Date(),
        },
      });

      markedCount++;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        duplicateCount++;
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push({ index: i, reason: message });
      }
    }
  }

  return { markedCount, duplicateCount, errors };
}
