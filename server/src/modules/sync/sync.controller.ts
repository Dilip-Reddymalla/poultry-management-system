import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { SyncAttendanceInputSchema } from "./sync.schema.js";
import { syncAttendance } from "./sync.service.js";

export async function handleSyncAttendance(req: Request, res: Response): Promise<void> {
  const authed = req as AuthenticatedRequest;
  const input = SyncAttendanceInputSchema.parse(req.body);
  const result = await syncAttendance(authed.scope!, input);
  res.json({ success: true, ...result });
}
