import { z } from "zod";

import { emailSchema } from "../auth/auth.schema.js";

const employeeIdSchema = z.string().trim().min(0, "Employee ID is required").optional();

const nameSchema = z.string().trim().min(1, "Name is required");

const phoneSchema = z.string().trim().min(1, "Phone number is required");

const photoUrlSchema = z.url("Invalid photo URL");

const designationIdSchema = z.uuid("Invalid designation ID");

const farmIdSchema = z.uuid("Invalid farm ID");

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const employeeIdParamSchema = z.object({
  id: z.uuid("Invalid employee ID"),
});

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must not exceed 100")
    .default(20),
  status: statusSchema.optional(),
  designationId: designationIdSchema.optional(),
  // Narrows within the caller's scope; a farmId outside scope simply yields no
  // rows (the scope filter still applies) rather than leaking another farm.
  farmId: farmIdSchema.optional(),
  search: z.string().trim().min(1, "Search must not be empty").optional(),
});

export const createEmployeeSchema = z.object({
  employeeId: employeeIdSchema.optional(),
  name: nameSchema,
  designationId: designationIdSchema,
  // Every employee belongs to exactly one farm; the caller must be allowed to
  // write to it (enforced in the service, never trusted from here alone).
  farmId: farmIdSchema,
  phone: phoneSchema.optional(),
  photoUrl: photoUrlSchema.optional(),
  joiningDate: z.coerce.date().optional(),
});

// employeeId is the permanent employee identity and status is owned by the
// deactivate/reactivate endpoints, so neither is updatable here.
export const updateEmployeeSchema = z
  .object({
    name: nameSchema,
    designationId: designationIdSchema,
    phone: phoneSchema.nullable(),
    photoUrl: photoUrlSchema.nullable(),
    joiningDate: z.coerce.date().nullable(),
  })
  .partial();

// A single role is assigned at provisioning time, matching how the seed
// provisions the DGM user. Additional roles can be layered on later. No password
// is accepted: provisioning is passwordless (phone-OTP first login, then the
// employee sets their own password), so a password never travels through here.
export const provisionUserSchema = z.object({
  email: emailSchema,
  roleId: z.uuid("Invalid role ID"),
});

export type EmployeeIdParamInput = z.infer<typeof employeeIdParamSchema>;

export type ListEmployeesQueryInput = z.infer<typeof listEmployeesQuerySchema>;

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export type ProvisionUserInput = z.infer<typeof provisionUserSchema>;
