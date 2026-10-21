import type { Request, Response } from "express";

import { getScope } from "../../middlewares/authorize.middleware.js";

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
import {
  getFarmShiftSchedule,
  resetFarmShiftTiming,
  updateFarmShiftTiming,
} from "../attendance/shift-timing.service.js";
import {
  createFarmCustomRole,
  deleteFarmCustomRole,
  getFarmRolesConfig,
  toggleFarmSystemRole,
  updateFarmCustomRole,
} from "./farm-role.service.js";

export async function listFarmsController(
  req: Request,
  res: Response,
): Promise<void> {
  const query = listFarmsQuerySchema.parse(req.query);

  const farms = await listFarms(getScope(req), query);

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

  const farm = await getFarmById(getScope(req), params.id);

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

  const farm = await createFarm(getScope(req), input);

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

  const farm = await updateFarm(getScope(req), params.id, input);

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

  const farm = await deactivateFarm(getScope(req), params.id);

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

  const farm = await reactivateFarm(getScope(req), params.id);

  res.status(200).json({
    success: true,
    message: "Farm reactivated successfully",
    farm,
  });
}

// --- Farm Shift Timings ---

export async function getFarmShiftScheduleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);
  const result = await getFarmShiftSchedule(getScope(req), params.id);

  res.status(200).json({
    success: true,
    ...result,
  });
}

export async function updateFarmShiftTimingController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);
  const shift = req.params.shift as any;
  const timing = await updateFarmShiftTiming(getScope(req), params.id, shift, req.body);

  res.status(200).json({
    success: true,
    message: "Shift timing updated successfully",
    timing,
  });
}

export async function resetFarmShiftTimingController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);
  const shift = req.params.shift as any;
  const timing = await resetFarmShiftTiming(getScope(req), params.id, shift);

  res.status(200).json({
    success: true,
    message: "Shift timing reset to default successfully",
    timing,
  });
}

// --- Farm Roles Configuration ---

export async function getFarmRolesConfigController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);
  const result = await getFarmRolesConfig(getScope(req), params.id);

  res.status(200).json({
    success: true,
    ...result,
  });
}

export async function toggleFarmSystemRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);
  const roleId = req.params.roleId as string;
  const { isEnabled } = req.body;
  const result = await toggleFarmSystemRole(getScope(req), params.id, roleId, Boolean(isEnabled));

  res.status(200).json({
    message: `Role ${isEnabled ? "enabled" : "disabled"} successfully`,
    ...result,
  });
}

export async function createFarmCustomRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);
  const role = await createFarmCustomRole(getScope(req), params.id, req.body);

  res.status(201).json({
    success: true,
    message: "Custom role created successfully",
    role,
  });
}

export async function updateFarmCustomRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);
  const roleId = req.params.roleId as string;
  const role = await updateFarmCustomRole(getScope(req), params.id, roleId, req.body);

  res.status(200).json({
    success: true,
    message: "Custom role updated successfully",
    role,
  });
}

export async function deleteFarmCustomRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = farmIdParamSchema.parse(req.params);
  const roleId = req.params.roleId as string;
  const result = await deleteFarmCustomRole(getScope(req), params.id, roleId);

  res.status(200).json({
    message: "Custom role deleted successfully",
    ...result,
  });
}

