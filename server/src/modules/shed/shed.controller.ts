import type { Request, Response } from "express";

import {
  createShed,
  getShedById,
  listSheds,
  updateShed,
  updateShedStatus,
} from "./shed.service.js";
import {
  createShedSchema,
  shedIdParamSchema,
  listShedsQuerySchema,
  updateShedSchema,
  updateShedStatusSchema,
} from "./shed.schema.js";

export async function listShedsController(
  req: Request,
  res: Response,
): Promise<void> {
  const query = listShedsQuerySchema.parse(req.query);

  const sheds = await listSheds(query);

  res.status(200).json({
    success: true,
    sheds,
  });
}

export async function getShedController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = shedIdParamSchema.parse(req.params);

  const shed = await getShedById(params.id);

  res.status(200).json({
    success: true,
    shed,
  });
}

export async function createShedController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createShedSchema.parse(req.body);

  const shed = await createShed(input);

  res.status(201).json({
    success: true,
    message: "Shed created successfully",
    shed,
  });
}

export async function updateShedController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = shedIdParamSchema.parse(req.params);

  const input = updateShedSchema.parse(req.body);

  const shed = await updateShed(params.id, input);

  res.status(200).json({
    success: true,
    message: "Shed updated successfully",
    shed,
  });
}

export async function updateShedStatusController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = shedIdParamSchema.parse(req.params);

  const input = updateShedStatusSchema.parse(req.body);

  const shed = await updateShedStatus(params.id, input);

  res.status(200).json({
    success: true,
    message: "Shed status updated successfully",
    shed,
  });
}
