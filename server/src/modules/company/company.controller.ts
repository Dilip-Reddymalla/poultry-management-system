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
  createCompanySchema,
  updateCompanySchema,
} from "./company.schema.js";

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

export async function createCompanyController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createCompanySchema.parse(req.body);

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

  const company = await updateCompany(getScope(req), params.id, input);

  res.status(200).json({
    success: true,
    message: "Company updated successfully",
    company,
  });
}
