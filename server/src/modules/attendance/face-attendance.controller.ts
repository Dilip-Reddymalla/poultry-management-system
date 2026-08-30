import type { Request, Response } from "express";

import { getScope } from "../../middlewares/authorize.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { processFrame, bulkMarkFaceAttendance } from "./face-attendance.service.js";
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
