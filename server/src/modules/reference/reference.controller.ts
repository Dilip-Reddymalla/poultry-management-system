import type { Request, Response } from "express";

import { listDesignations, listPermissions, listRoles } from "./reference.service.js";

export async function listDesignationsController(
  req: Request,
  res: Response,
): Promise<void> {
  const farmId = typeof req.query.farmId === "string" ? req.query.farmId : undefined;
  const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
  const designations = await listDesignations(farmId, companyId);

  res.status(200).json({
    success: true,
    designations,
  });
}

export async function listRolesController(
  req: Request,
  res: Response,
): Promise<void> {
  const farmId = typeof req.query.farmId === "string" ? req.query.farmId : undefined;
  const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
  const roles = await listRoles(farmId, companyId);

  res.status(200).json({
    success: true,
    roles,
  });
}

export async function listPermissionsController(
  _req: Request,
  res: Response,
): Promise<void> {
  const permissions = await listPermissions();

  res.status(200).json({
    success: true,
    permissions,
  });
}

