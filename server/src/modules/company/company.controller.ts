import type { Request, Response } from "express";

import { getScope } from "../../middlewares/authorize.middleware.js";

import {
  createCompany,
  getCompanyById,
  listCompanies,
  updateCompany,
} from "./company.service.js";
import {
  companyIdParamSchema,
  createCompanyCustomRoleSchema,
  createCompanySchema,
  updateCompanyCustomRoleSchema,
  updateCompanyRolesHierarchySchema,
  updateCompanySchema,
} from "./company.schema.js";
import {
  getCompanyShiftSchedule,
  updateCompanyShiftTiming,
} from "../attendance/shift-timing.service.js";
import {
  bulkToggleCompanyRoles,
  createCompanyCustomRole,
  deleteCompanyCustomRole,
  getCompanyRolesConfig,
  toggleCompanyRole,
  updateCompanyCustomRole,
  updateCompanyRole,
  updateCompanyRolesHierarchy,
} from "./company-role.service.js";


export async function listCompaniesController(
  req: Request,
  res: Response,
): Promise<void> {
  const companies = await listCompanies(getScope(req));

  res.status(200).json({
    success: true,
    companies,
  });
}

export async function getCompanyController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);

  const company = await getCompanyById(getScope(req), params.id);

  res.status(200).json({
    success: true,
    company,
  });
}

import { uploadImage } from "../../services/cloudinary.service.js";

export async function createCompanyController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createCompanySchema.parse(req.body);

  if (req.file) {
    const uploadResult = await uploadImage(req.file.buffer, "companies/logos");
    input.logoUrl = uploadResult.url;
  }

  const company = await createCompany(getScope(req), input);

  res.status(201).json({
    success: true,
    message: "Company created successfully",
    company,
  });
}

export async function updateCompanyController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);

  const input = updateCompanySchema.parse(req.body);

  if (req.file) {
    const uploadResult = await uploadImage(req.file.buffer, "companies/logos");
    input.logoUrl = uploadResult.url;
  }

  const company = await updateCompany(getScope(req), params.id, input);

  res.status(200).json({
    success: true,
    message: "Company updated successfully",
    company,
  });
}

export async function getCompanyShiftScheduleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const result = await getCompanyShiftSchedule(getScope(req), params.id);

  res.status(200).json({
    success: true,
    ...result,
  });
}

export async function updateCompanyShiftTimingController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const shift = req.params.shift as any;
  const timing = await updateCompanyShiftTiming(getScope(req), params.id, shift, req.body);

  res.status(200).json({
    success: true,
    message: "Company shift timing updated successfully",
    timing,
  });
}

export async function getCompanyRolesConfigController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const result = await getCompanyRolesConfig(getScope(req), params.id);

  res.status(200).json({
    success: true,
    ...result,
  });
}

export async function toggleCompanyRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const roleId = req.params.roleId as string;
  const { isEnabled } = req.body;
  const result = await toggleCompanyRole(getScope(req), params.id, roleId, Boolean(isEnabled));

  res.status(200).json({
    message: `Role ${isEnabled ? "enabled" : "disabled"} successfully`,
    ...result,
  });
}

export async function bulkToggleCompanyRolesController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const { enabled } = req.body;
  const result = await bulkToggleCompanyRoles(getScope(req), params.id, Boolean(enabled));

  res.status(200).json({
    message: `All optional roles ${enabled ? "enabled" : "disabled"} successfully`,
    ...result,
  });
}

export async function updateCompanyRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const roleId = req.params.roleId as string;
  const result = await updateCompanyRole(getScope(req), params.id, roleId, req.body);

  res.status(200).json({
    message: "Company role updated successfully",
    ...result,
  });
}

export async function updateCompanyRolesHierarchyController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const parsed = updateCompanyRolesHierarchySchema.parse(req.body);
  const result = await updateCompanyRolesHierarchy(getScope(req), params.id, parsed.hierarchy);

  res.status(200).json({
    message: "Company roles hierarchy updated successfully",
    ...result,
  });
}

export async function createCompanyCustomRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const input = createCompanyCustomRoleSchema.parse(req.body);
  const role = await createCompanyCustomRole(getScope(req), params.id, input);

  res.status(201).json({
    message: "Company custom role created successfully",
    role,
  });
}

export async function updateCompanyCustomRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const roleId = req.params.roleId as string;
  const input = updateCompanyCustomRoleSchema.parse(req.body);
  const role = await updateCompanyCustomRole(getScope(req), params.id, roleId, input);

  res.status(200).json({
    message: "Company custom role updated successfully",
    role,
  });
}

export async function deleteCompanyCustomRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = companyIdParamSchema.parse(req.params);
  const roleId = req.params.roleId as string;
  const result = await deleteCompanyCustomRole(getScope(req), params.id, roleId);

  res.status(200).json({
    message: "Company custom role deleted successfully",
    ...result,
  });
}


