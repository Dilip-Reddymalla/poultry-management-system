import type { Request, Response } from "express";

import { getShedById, listSheds } from "./shed.service.js";
import { shedIdParamSchema, listShedsQuerySchema } from "./shed.schema.js";

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
