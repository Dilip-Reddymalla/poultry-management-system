import { z } from "zod";

const workerIdSchema = z.string().trim().min(1, "Worker ID is required");

const nameSchema = z.string().trim().min(1, "Name is required");

const phoneSchema = z.string().trim().min(1, "Phone number is required");

const farmIdSchema = z.uuid("Invalid farm ID");

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const workerIdParamSchema = z.object({
  id: z.uuid("Invalid worker ID"),
});

export const listWorkersQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must not exceed 100")
    .default(20),
  status: statusSchema.optional(),
  // Narrows within the caller's scope; a farmId outside scope yields no rows.
  farmId: farmIdSchema.optional(),
  search: z.string().trim().min(1, "Search must not be empty").optional(),
});

export const createWorkerSchema = z.object({
  workerId: workerIdSchema,
  name: nameSchema,
  // Every worker belongs to exactly one farm; the caller must be allowed to write
  // to it (enforced in the service).
  farmId: farmIdSchema,
  phone: phoneSchema.optional(),
});

// The owning farm is fixed at creation so a worker can never be moved across
// farms, and status is owned by the deactivate/reactivate endpoints.
export const updateWorkerSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema.nullable(),
  })
  .partial();

export type WorkerIdParamInput = z.infer<typeof workerIdParamSchema>;

export type ListWorkersQueryInput = z.infer<typeof listWorkersQuerySchema>;

export type CreateWorkerInput = z.infer<typeof createWorkerSchema>;

export type UpdateWorkerInput = z.infer<typeof updateWorkerSchema>;
