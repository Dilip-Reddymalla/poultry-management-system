import { z } from "zod";

const statusSchema = z.enum([
  "AVAILABLE",
  "OCCUPIED",
  "MAINTENANCE",
  "INACTIVE",
]);

export const shedIdParamSchema = z.object({
  id: z.uuid("Invalid shed ID"),
});

export const listShedsQuerySchema = z.object({
  farmId: z.uuid("Invalid farm ID").optional(),
  status: statusSchema.optional(),
});

export type ShedIdParamInput = z.infer<typeof shedIdParamSchema>;

export type ListShedsQueryInput = z.infer<typeof listShedsQuerySchema>;
