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
  const startTime = Date.now();

  console.log(
    `[Face-AI Client] 🔍 Sending image analysis request to ${url} (File: ${filename}, Size: ${(imageBuffer.length / 1024).toFixed(1)} KB)`,
  );

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

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[Face-AI Client] ❌ Target ${url} responded with HTTP ${response.status} in ${duration}ms: ${errorBody}`,
      );
      throw new AppError(
        `FastAPI Face AI service returned ${response.status}: ${errorBody}`,
        502,
      );
    }

    const data = (await response.json()) as FaceAIResponse;
    console.log(
      `[Face-AI Client] ✅ Analysis succeeded in ${duration}ms. Detected ${data.face_count} face(s).`,
    );
    return data;
  } catch (err: any) {
    const duration = Date.now() - startTime;
    if (err instanceof AppError) throw err;

    console.error(`[Face-AI Client] ❌ Connection failure requesting ${url} (${duration}ms):`, {
      message: err?.message,
      code: err?.code || err?.cause?.code,
      syscall: err?.cause?.syscall || err?.syscall,
      address: err?.cause?.address || err?.address,
      port: err?.cause?.port || err?.port,
      cause: err?.cause,
    });

    if (
      err?.cause?.code === "ECONNREFUSED" ||
      err?.code === "ECONNREFUSED" ||
      (err?.message && err.message.includes("fetch failed"))
    ) {
      throw new AppError(
        `Face AI service is unavailable (ECONNREFUSED connecting to ${url}). Check target URL FASTAPI_AI_URL=${env.FASTAPI_AI_URL} and verify Python Face AI process is running.`,
        503,
      );
    }
    throw new AppError(
      `Failed to analyze image with Face AI service (${err?.message || "Unknown error"})`,
      500,
    );
  }
}

