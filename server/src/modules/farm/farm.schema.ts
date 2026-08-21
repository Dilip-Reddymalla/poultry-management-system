import { z } from "zod";

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const farmIdParamSchema = z.object({
  id: z.uuid("Invalid farm ID"),
});

export const listFarmsQuerySchema = z.object({
  status: statusSchema.optional(),
});

export type FarmIdParamInput = z.infer<typeof farmIdParamSchema>;

export type ListFarmsQueryInput = z.infer<typeof listFarmsQuerySchema>;
