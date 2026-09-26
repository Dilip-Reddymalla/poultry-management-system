import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";
import { faceAiCircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker.js";

export { faceAiCircuitBreaker, CircuitBreakerOpenError };

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

  return faceAiCircuitBreaker.execute(async (signal) => {
    const startTime = Date.now();
    logger.info(
      { url, filename, sizeKb: (imageBuffer.length / 1024).toFixed(1) },
      "[Face-AI Client] 🔍 Sending image analysis request",
    );

    try {
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
        signal,
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        let parsedDetail = "";
        try {
          const json = JSON.parse(errorBody);
          parsedDetail = json.detail || json.message || errorBody;
        } catch {
          parsedDetail = errorBody;
        }

        logger.error(
          { url, status: response.status, durationMs: duration, errorBody },
          "[Face-AI Client] ❌ Target responded with HTTP error",
        );

        if (response.status < 500) {
          throw new AppError(
            `Image processing failed: ${parsedDetail || "Unable to process the image. Please upload a clearer, well-lit photo."}`,
            response.status,
            { error: "INVALID_IMAGE_INPUT", detail: parsedDetail },
            "INVALID_IMAGE_INPUT",
          );
        }

        throw new AppError(
          `FastAPI Face AI service returned ${response.status}: ${parsedDetail}`,
          response.status >= 500 ? 502 : response.status,
          {
            error: "FACE_AI_UNAVAILABLE",
            fallbackMode: "MANUAL_ATTENDANCE",
            manualAttendanceUrl: "/attendance",
          },
          "FACE_AI_HTTP_ERROR",
        );
      }

      const data = (await response.json()) as FaceAIResponse;
      logger.info(
        { url, durationMs: duration, faceCount: data.face_count },
        "[Face-AI Client] ✅ Analysis succeeded",
      );
      return data;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      if (err instanceof AppError) throw err;

      logger.error(
        {
          url,
          durationMs: duration,
          message: err?.message,
          code: err?.code || err?.cause?.code,
          syscall: err?.cause?.syscall || err?.syscall,
          address: err?.cause?.address || err?.address,
          port: err?.cause?.port || err?.port,
          cause: err?.cause,
        },
        "[Face-AI Client] ❌ Connection failure",
      );

      if (
        err?.cause?.code === "ECONNREFUSED" ||
        err?.code === "ECONNREFUSED" ||
        (err?.message && (err.message.includes("fetch failed") || err.message.includes("timed out")))
      ) {
        throw new AppError(
          `Face AI service is unavailable (connecting to ${url}). Check target URL FASTAPI_AI_URL=${env.FASTAPI_AI_URL} and verify Python Face AI process is running.`,
          503,
          {
            error: "FACE_AI_UNAVAILABLE",
            fallbackMode: "MANUAL_ATTENDANCE",
            manualAttendanceUrl: "/attendance",
          },
          "FACE_AI_UNAVAILABLE",
        );
      }
      throw new AppError(
        `Failed to analyze image with Face AI service (${err?.message || "Unknown error"})`,
        500,
        {
          error: "FACE_AI_ERROR",
          fallbackMode: "MANUAL_ATTENDANCE",
          manualAttendanceUrl: "/attendance",
        },
        "FACE_AI_ERROR",
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Profile enrollment — selects the best face from a multi-face image
// ---------------------------------------------------------------------------

export interface ProfileEnrollFaceResult extends FaceAIFaceResult {}

export interface ProfileEnrollResponse {
  success: boolean;
  filename: string;
  image_width: number;
  image_height: number;
  total_faces_detected: number;
  selected_face: ProfileEnrollFaceResult | null;
  selection_reason: string;
  process_time_ms: number;
}

/**
 * Send an image to the Face AI profile enrollment endpoint.
 *
 * Unlike the generic `analyzeImage`, this endpoint automatically selects the
 * single best face (most centered, highest confidence) from the image for
 * embedding storage.  Designed for employee / worker profile photos.
 */
export async function analyzeProfilePhoto(
  imageBuffer: Buffer,
  filename: string,
): Promise<ProfileEnrollResponse> {
  const url = `${env.FASTAPI_AI_URL}/api/v1/recognition/profile-enroll`;

  return faceAiCircuitBreaker.execute(async (signal) => {
    const startTime = Date.now();
    logger.info(
      { url, filename, sizeKb: (imageBuffer.length / 1024).toFixed(1) },
      "[Face-AI Client] 🔍 Sending profile enrollment request",
    );

    try {
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
        signal,
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        let parsedDetail = "";
        try {
          const json = JSON.parse(errorBody);
          parsedDetail = json.detail || json.message || errorBody;
        } catch {
          parsedDetail = errorBody;
        }

        logger.error(
          { url, status: response.status, durationMs: duration, errorBody },
          "[Face-AI Client] ❌ Profile enrollment responded with HTTP error",
        );

        if (response.status < 500) {
          throw new AppError(
            `Profile photo processing failed: ${parsedDetail || "Unable to process photo. Please upload a clearer photo."}`,
            response.status,
            { error: "INVALID_IMAGE_INPUT", detail: parsedDetail },
            "INVALID_IMAGE_INPUT",
          );
        }

        throw new AppError(
          `FastAPI Face AI service returned ${response.status}: ${parsedDetail}`,
          response.status >= 500 ? 502 : response.status,
          {
            error: "FACE_AI_UNAVAILABLE",
            fallbackMode: "MANUAL_ATTENDANCE",
          },
          "FACE_AI_HTTP_ERROR",
        );
      }

      const data = (await response.json()) as ProfileEnrollResponse;
      logger.info(
        {
          url,
          durationMs: duration,
          totalFacesDetected: data.total_faces_detected,
          selectedFace: data.selected_face ? `#${data.selected_face.face_index}` : "none",
        },
        "[Face-AI Client] ✅ Profile enrollment succeeded",
      );
      return data;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      if (err instanceof AppError) throw err;

      logger.error(
        {
          url,
          durationMs: duration,
          message: err?.message,
          code: err?.code || err?.cause?.code,
        },
        "[Face-AI Client] ❌ Connection failure",
      );

      if (
        err?.cause?.code === "ECONNREFUSED" ||
        err?.code === "ECONNREFUSED" ||
        (err?.message && (err.message.includes("fetch failed") || err.message.includes("timed out")))
      ) {
        throw new AppError(
          `Face AI service is unavailable (connecting to ${url}). Check FASTAPI_AI_URL=${env.FASTAPI_AI_URL}.`,
          503,
          {
            error: "FACE_AI_UNAVAILABLE",
            fallbackMode: "MANUAL_ATTENDANCE",
          },
          "FACE_AI_UNAVAILABLE",
        );
      }
      throw new AppError(
        `Failed to analyze profile photo with Face AI service (${err?.message || "Unknown error"})`,
        500,
        {
          error: "FACE_AI_ERROR",
        },
        "FACE_AI_ERROR",
      );
    }
  });
}
