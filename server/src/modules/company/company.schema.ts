import { z } from "zod";

const nameSchema = z.string().trim().min(1, "Company name is required");

const codeSchema = z.string().trim().min(1, "Company code is required");

export const companyIdParamSchema = z.object({
  id: z.uuid("Invalid company ID"),
});

export const createCompanySchema = z.object({
  name: nameSchema,
  code: codeSchema,
});

// Both fields are optional so a company can be renamed or recoded independently.
export const updateCompanySchema = z
  .object({
    name: nameSchema,
    code: codeSchema,
  })
  .partial();

export type CompanyIdParamInput = z.infer<typeof companyIdParamSchema>;

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
