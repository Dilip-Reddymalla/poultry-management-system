import type { Request, Response } from "express";

import {
  createFarm,
  deactivateFarm,
  getFarmById,
  listFarms,
  reactivateFarm,
  updateFarm,
} from "./farm.service.js";
import {
  createFarmSchema,
  farmIdParamSchema,
  listFarmsQuerySchema,
  updateFarmSchema,
} from "./farm.schema.js";

export async function listFarmsController(
  req: Request,
  res: Response,
): Promise<void> {
  const query = listFarmsQuerySchema.parse(req.query);

  const farms = await listFarms(query);

  res.status(200).json({
    success: true,
    farms,
  });
}

export async function getFarmController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);

  const farm = await getFarmById(params.id);

  res.status(200).json({
    success: true,
    farm,
  });
}

export async function createFarmController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createFarmSchema.parse(req.body);

  const farm = await createFarm(input);

  res.status(201).json({
    success: true,
    message: "Farm created successfully",
    farm,
  });
}

export async function updateFarmController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);

  const input = updateFarmSchema.parse(req.body);

  const farm = await updateFarm(params.id, input);

  res.status(200).json({
    success: true,
    message: "Farm updated successfully",
    farm,
  });
}

export async function deactivateFarmController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);

  const farm = await deactivateFarm(params.id);

  res.status(200).json({
    success: true,
    message: "Farm deactivated successfully",
    farm,
  });
}

export async function reactivateFarmController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);

  const farm = await reactivateFarm(params.id);

  res.status(200).json({
    success: true,
    message: "Farm reactivated successfully",
    farm,
  });
}
