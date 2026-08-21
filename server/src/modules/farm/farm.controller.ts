import type { Request, Response } from "express";

import { getFarmById, listFarms } from "./farm.service.js";
import { farmIdParamSchema, listFarmsQuerySchema } from "./farm.schema.js";

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
