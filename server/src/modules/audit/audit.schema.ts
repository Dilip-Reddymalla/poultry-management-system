import { z } from "zod";

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  entity: z.string().trim().optional(),
  action: z.enum(["CREATE", "UPDATE", "DELETE"]).optional(),
  search: z.string().trim().optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

export const exportAuditLogsQuerySchema = z.object({
  entity: z.string().trim().optional(),
  action: z.enum(["CREATE", "UPDATE", "DELETE"]).optional(),
  search: z.string().trim().optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

export type ListAuditLogsQueryInput = z.infer<typeof listAuditLogsQuerySchema>;
export type ExportAuditLogsQueryInput = z.infer<typeof exportAuditLogsQuerySchema>;
