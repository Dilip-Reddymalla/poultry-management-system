import { z } from "zod";

const nameSchema = z.string().trim().min(1, "Company name is required");

const codeSchema = z.string().trim().min(1, "Company code is required");

export const companyIdParamSchema = z.object({
  id: z.uuid("Invalid company ID"),
});

export const createCompanySchema = z.object({
  name: nameSchema,
  code: codeSchema,
  logoUrl: z.string().url().nullable().optional(),
  website: z.string().url().or(z.string().trim().length(0)).nullable().optional(),
});

// Fields are optional so a company can be renamed, recoded, or logo updated independently.
export const updateCompanySchema = z
  .object({
    name: nameSchema,
    code: codeSchema,
    logoUrl: z.string().url().nullable().optional(),
    website: z.string().url().or(z.string().trim().length(0)).nullable().optional(),
  })
  .partial();

export type CompanyIdParamInput = z.infer<typeof companyIdParamSchema>;

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const updateCompanyRolesHierarchySchema = z.object({
  hierarchy: z.array(
    z.object({
      roleId: z.string().uuid("Invalid role ID"),
      isEnabled: z.boolean(),
      customRank: z.number().int().min(1).max(100).nullable().optional(),
    }),
  ).min(1, "At least one role configuration is required"),
});

export type UpdateCompanyRolesHierarchyInput = z.infer<typeof updateCompanyRolesHierarchySchema>;

export const createCompanyCustomRoleSchema = z.object({
  name: z.string().trim().min(2, "Role name must be at least 2 characters long"),
  description: z.string().trim().optional(),
  scopeLevel: z.enum(["COMPANY", "FARM"]).default("COMPANY"),
  permissionIds: z.array(z.string().uuid("Invalid permission ID")).default([]),
  rank: z.number().int().min(1).max(100).default(30),
});

export type CreateCompanyCustomRoleInput = z.infer<typeof createCompanyCustomRoleSchema>;

export const updateCompanyCustomRoleSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  scopeLevel: z.enum(["COMPANY", "FARM"]).optional(),
  permissionIds: z.array(z.string().uuid("Invalid permission ID")).optional(),
  rank: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCompanyCustomRoleInput = z.infer<typeof updateCompanyCustomRoleSchema>;

