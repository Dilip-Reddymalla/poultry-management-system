import { apiClient, API_BASE_URL, ApiError } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FaceCandidateMatch {
  id: string;
  personType: "EMPLOYEE" | "WORKER";
  personCode: string;
  name: string;
  photoUrl: string | null;
  farmId: string;
  similarity: number;
}

export interface ProcessedFace {
  faceIndex: number;
  bbox: number[];
  /** LIVE | SPOOF | REJECTED_LOW_QUALITY */
  status: string;
  qualityScore: number | null;
  livenessScore: number | null;
  candidates: FaceCandidateMatch[];
}

export interface FrameProcessResult {
  success: boolean;
  imageWidth: number;
  imageHeight: number;
  faceCount: number;
  faces: ProcessedFace[];
  processTimeMs: number;
  snapshotUrl: string | null;
}

export interface FaceAttendanceRecord {
  employeeId?: string | undefined;
  workerId?: string | undefined;
  shedId?: string | undefined;
  date: string;
  shift: string;
  status: string;
  latitude: number;
  longitude: number;
  livenessScore?: number | undefined;
  qualityScore?: number | undefined;
  confidenceScore?: number | undefined;
  snapshotUrl?: string | undefined;
  notes?: string | undefined;
}

export interface BulkMarkResult {
  success: boolean;
  message: string;
  markedCount: number;
  duplicateCount: number;
  errors: Array<{ index: number; reason: string }>;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Send a camera frame to the backend for face detection and matching.
 * Uses raw `fetch` because `apiClient` always sets Content-Type: application/json
 * which breaks multipart FormData uploads.
 */
export async function processFrame(
  imageFile: File,
  farmId: string,
): Promise<FrameProcessResult> {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("farmId", farmId);

  const res = await fetch(`${API_BASE_URL}/attendance/face/process-frame`, {
    method: "POST",
    credentials: "include",
    body: formData,
    // Don't set Content-Type — browser will set multipart boundary automatically.
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      (payload as any)?.message || `Server error: ${res.status}`,
    );
  }

  return payload as FrameProcessResult;
}

/**
 * Submit confirmed face attendance records.
 */
export async function bulkMarkFaceAttendance(
  records: FaceAttendanceRecord[],
): Promise<BulkMarkResult> {
  return apiClient.post<BulkMarkResult>("/attendance/face/bulk-mark", {
    records,
  });
}
