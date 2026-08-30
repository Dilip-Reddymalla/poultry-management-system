import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

// ---------------------------------------------------------------------------
// Types mirroring the FastAPI response schemas
// ---------------------------------------------------------------------------

export interface FaceAIQualityMetrics {
  face_width: number;
  face_height: number;
  face_area: number;
  relative_area: number;
  detection_confidence: number | null;
  sharpness: number | null;
  landmarks_valid: boolean;
}

export interface FaceAIQualityResult {
  usable: boolean;
  decision: string; // "ACCEPT" | "REJECT"
  quality_score: number;
  reasons: string[];
  metrics: FaceAIQualityMetrics;
}

export interface FaceAILivenessResult {
  decision: string; // "LIVE" | "SPOOF"
  score: number;
  scores: Record<string, number>;
}

export interface FaceAIMatchCandidate {
  identity: string;
  similarity: number;
}

export interface FaceAIRecognitionResult {
  status: string; // "MATCHED" | "UNKNOWN" | "SPOOF" | "REJECTED_LOW_QUALITY"
  identity: string | null;
  similarity: number | null;
  candidates: FaceAIMatchCandidate[];
}

export interface FaceAIFaceResult {
  face_index: number;
  bbox: number[];
  detection_confidence: number;
  landmarks: number[][] | null;
  quality: FaceAIQualityResult;
  liveness: FaceAILivenessResult | null;
  recognition: FaceAIRecognitionResult;
  embedding: number[] | null;
}

export interface FaceAIResponse {
  success: boolean;
  filename: string;
  image_width: number;
  image_height: number;
  face_count: number;
  faces: FaceAIFaceResult[];
  process_time_ms: number;
}

// ---------------------------------------------------------------------------
// HTTP client for the FastAPI Face AI service
// ---------------------------------------------------------------------------

/**
 * Send an image to the FastAPI Face AI service for analysis.
 *
 * Uses the native `fetch` API available in Node 18+.
 *
 * @param imageBuffer - Raw image bytes (JPEG / PNG / WEBP).
 * @param filename    - Original filename for the upload.
 * @returns           - Parsed FastAPI response with per-face results & embeddings.
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  filename: string,
): Promise<FaceAIResponse> {
  const url = `${env.FASTAPI_AI_URL}/api/v1/recognition/analyze`;

  try {
    // Build multipart/form-data manually using standard FormData + Blob API
    const formData = new FormData();
    const arrayBuffer = imageBuffer.buffer.slice(
      imageBuffer.byteOffset,
      imageBuffer.byteOffset + imageBuffer.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
    formData.append("file", blob, filename);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(
        `FastAPI Face AI service returned ${response.status}: ${errorBody}`,
        502,
      );
    }

    const data = (await response.json()) as FaceAIResponse;
    return data;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (
      err?.cause?.code === "ECONNREFUSED" ||
      err?.code === "ECONNREFUSED" ||
      (err?.message && err.message.includes("fetch failed"))
    ) {
      throw new AppError(
        `Face AI service is unavailable (ECONNREFUSED at ${env.FASTAPI_AI_URL}). Please ensure the Python Face AI server is running on port 8000.`,
        503,
      );
    }
    throw new AppError(err?.message || "Failed to analyze image with Face AI service", 500);
  }
}

