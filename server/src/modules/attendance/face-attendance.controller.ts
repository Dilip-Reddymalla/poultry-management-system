import type { Request, Response } from "express";

import { getScope } from "../../middlewares/authorize.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { processFrame, bulkMarkFaceAttendance } from "./face-attendance.service.js";
import { faceAiCircuitBreaker } from "../../services/circuit-breaker.js";
import {
  processFrameSchema,
  bulkMarkFaceAttendanceSchema,
} from "./face-attendance.schema.js";

/**
 * POST /api/attendance/face/process-frame
 *
 * Accepts a camera image (multipart `image` field) + farmId.
 * Sends to FastAPI → detects faces → runs pgvector search → returns candidates.
 */
export async function processFrameController(
  req: Request,
  res: Response,
): Promise<void> {
  // Fail-fast circuit breaker check
  if (faceAiCircuitBreaker.isOpen()) {
    const metrics = faceAiCircuitBreaker.getMetrics();
    res.status(503).json({
      success: false,
      error: "FACE_AI_UNAVAILABLE",
      code: "FACE_AI_CIRCUIT_OPEN",
      fallbackMode: "MANUAL_ATTENDANCE",
      message: "Face AI biometric service is currently unavailable (circuit breaker OPEN). Switched to manual attendance mode.",
      manualAttendanceUrl: "/attendance",
      circuitBreaker: {
        state: metrics.state,
        consecutiveFailures: metrics.consecutiveFailures,
        nextAttemptInMs: metrics.nextAttemptInMs,
      },
    });
    return;
  }

  const file = req.file;

  if (!file || !file.buffer.length) {
    throw new AppError("No image file uploaded", 400);
  }

  const input = processFrameSchema.parse(req.body);

  const result = await processFrame(
    file.buffer,
    file.originalname,
    input.farmId,
    getScope(req),
  );

  res.status(200).json({
    success: true,
    ...result,
  });
}

/**
 * POST /api/attendance/face/bulk-mark
 *
 * Accepts an array of confirmed face attendance records and saves them.
 */
export async function bulkMarkFaceAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = bulkMarkFaceAttendanceSchema.parse(req.body);

  const result = await bulkMarkFaceAttendance(getScope(req), input);

  res.status(207).json({
    success: true,
    message: "Face attendance processed",
    ...result,
  });
}
