import type { Request, Response } from "express";

import { getScope } from "../../middlewares/authorize.middleware.js";
import { analyzeImage } from "../../services/face-ai.service.js";
import { uploadImage as cloudinaryUpload, deleteImage as cloudinaryDelete } from "../../services/cloudinary.service.js";
import { AppError } from "../../utils/app-error.js";

import {
  createWorker,
  deactivateWorker,
  getWorkerById,
  listWorkers,
  reactivateWorker,
  updateWorker,
} from "./worker.service.js";
import {
  createWorkerSchema,
  listWorkersQuerySchema,
  updateWorkerSchema,
  workerIdParamSchema,
} from "./worker.schema.js";

/**
 * Process an uploaded photo through the Face AI pipeline.
 * Returns the Cloudinary URL, embedding array, and old publicId (if replacing).
 */
async function processFacePhoto(
  file: Express.Multer.File,
  folder: string,
): Promise<{ photoUrl: string; publicId: string; faceEmbedding: number[] }> {
  // 1. Send to FastAPI for analysis
  const aiResult = await analyzeImage(file.buffer, file.originalname);

  const face = aiResult.faces[0];
  if (!face) {
    throw new AppError("No face detected in the uploaded photo", 400);
  }

  if (!face.quality.usable) {
    const reasons = face.quality.reasons.join(", ");
    throw new AppError(
      `Face rejected: Low quality — ${reasons || "does not meet quality threshold"}`,
      400,
    );
  }

  if (!face.liveness || face.liveness.decision !== "LIVE") {
    throw new AppError(
      "Face rejected: Photo spoof detected. Please use a live camera image.",
      400,
    );
  }

  if (!face.embedding) {
    throw new AppError(
      "Face rejected: Unable to generate face embedding",
      400,
    );
  }

  // 2. Upload to Cloudinary
  const { url, publicId } = await cloudinaryUpload(file.buffer, folder);

  return {
    photoUrl: url,
    publicId,
    faceEmbedding: face.embedding,
  };
}

export async function listWorkersController(
  req: Request,
  res: Response,
): Promise<void> {
  const query = listWorkersQuerySchema.parse(req.query);

  const { workers, pagination } = await listWorkers(getScope(req), query);

  res.status(200).json({
    success: true,
    workers,
    pagination,
  });
}

export async function getWorkerController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = workerIdParamSchema.parse(req.params);

  const worker = await getWorkerById(getScope(req), params.id);

  res.status(200).json({
    success: true,
    worker,
  });
}

export async function createWorkerController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createWorkerSchema.parse(req.body);
  const file = req.file;

  let photoUrl: string | undefined;
  let faceEmbedding: number[] | undefined;

  if (file) {
    const result = await processFacePhoto(file, "workers/profiles");
    photoUrl = result.photoUrl;
    faceEmbedding = result.faceEmbedding;
  }

  const worker = await createWorker(getScope(req), input, {
    photoUrl,
    faceEmbedding,
  });

  res.status(201).json({
    success: true,
    message: "Worker created successfully",
    worker,
  });
}

export async function updateWorkerController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = workerIdParamSchema.parse(req.params);
  const input = updateWorkerSchema.parse(req.body);
  const file = req.file;

  let photoUrl: string | undefined;
  let faceEmbedding: number[] | undefined;

  if (file) {
    const result = await processFacePhoto(file, "workers/profiles");
    photoUrl = result.photoUrl;
    faceEmbedding = result.faceEmbedding;
  }

  const worker = await updateWorker(getScope(req), params.id, input, {
    photoUrl,
    faceEmbedding,
  });

  res.status(200).json({
    success: true,
    message: "Worker updated successfully",
    worker,
  });
}

export async function deactivateWorkerController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = workerIdParamSchema.parse(req.params);

  const worker = await deactivateWorker(getScope(req), params.id);

  res.status(200).json({
    success: true,
    message: "Worker deactivated successfully",
    worker,
  });
}

export async function reactivateWorkerController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = workerIdParamSchema.parse(req.params);

  const worker = await reactivateWorker(getScope(req), params.id);

  res.status(200).json({
    success: true,
    message: "Worker reactivated successfully",
    worker,
  });
}
