import type { Request, Response } from "express";
import {
  listAuditLogsQuerySchema,
  exportAuditLogsQuerySchema,
} from "./audit.schema.js";
import { listAuditLogs, exportAuditLogs } from "./audit.service.js";

export async function handleListAuditLogs(req: Request, res: Response): Promise<void> {
  const query = listAuditLogsQuerySchema.parse(req.query);
  const result = await listAuditLogs(query);
  res.json({ success: true, ...result });
}

export async function handleExportAuditLogs(req: Request, res: Response): Promise<void> {
  const query = exportAuditLogsQuerySchema.parse(req.query);
  await exportAuditLogs(query, res);
}
