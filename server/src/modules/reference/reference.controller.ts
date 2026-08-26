import type { Request, Response } from "express";

import { listDesignations, listRoles } from "./reference.service.js";

export async function listDesignationsController(
  _req: Request,
  res: Response,
): Promise<void> {
  const designations = await listDesignations();

  res.status(200).json({
    success: true,
    designations,
  });
}

export async function listRolesController(
  _req: Request,
  res: Response,
): Promise<void> {
  const roles = await listRoles();

  res.status(200).json({
    success: true,
    roles,
  });
}
