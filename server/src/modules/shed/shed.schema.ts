import { z } from "zod";

const statusSchema = z.enum([
  "AVAILABLE",
  "OCCUPIED",
  "MAINTENANCE",
  "INACTIVE",
]);

// OCCUPIED is reserved for batch occupancy, which is owned by the (not yet
// implemented) batch lifecycle, so it cannot be set through the status endpoint.
const manageableStatusSchema = z.enum([
  "AVAILABLE",
  "MAINTENANCE",
  "INACTIVE",
]);

const numberSchema = z.string().trim().min(1, "Shed number is required");

const capacitySchema = z
  .number()
  .int("Capacity must be a whole number")
  .min(0, "Capacity must be zero or greater");

export const shedIdParamSchema = z.object({
  id: z.uuid("Invalid shed ID"),
});

export const listShedsQuerySchema = z.object({
  farmId: z.uuid("Invalid farm ID").optional(),
  status: statusSchema.optional(),
});

export const createShedSchema = z.object({
  farmId: z.uuid("Invalid farm ID"),
  number: numberSchema,
  capacity: capacitySchema,
});

// The owning farm is fixed at creation so a shed can never be moved across
// farms, and status is owned by the status endpoint.
export const updateShedSchema = z
  .object({
    number: numberSchema,
    capacity: capacitySchema,
  })
  .partial();

export const updateShedStatusSchema = z.object({
  status: manageableStatusSchema,
});

export type ShedIdParamInput = z.infer<typeof shedIdParamSchema>;

export type ListShedsQueryInput = z.infer<typeof listShedsQuerySchema>;

export type CreateShedInput = z.infer<typeof createShedSchema>;

export type UpdateShedInput = z.infer<typeof updateShedSchema>;

export type UpdateShedStatusInput = z.infer<typeof updateShedStatusSchema>;
