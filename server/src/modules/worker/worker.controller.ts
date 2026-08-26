import type { Request, Response } from "express";

import { getScope } from "../../middlewares/authorize.middleware.js";

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

  const worker = await createWorker(getScope(req), input);

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

  const worker = await updateWorker(getScope(req), params.id, input);

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
