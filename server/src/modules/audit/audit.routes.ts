import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { handleListAuditLogs, handleExportAuditLogs } from "./audit.controller.js";

const auditRouter = Router();

// Require logged-in user and System Admin role
auditRouter.use(requireAuth);
auditRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).scope?.isSystemAdmin) {
    return next(new AppError("Only System Administrator can access audit logs", 403));
  }
  next();
});

auditRouter.get("/", handleListAuditLogs);
auditRouter.get("/export", handleExportAuditLogs);

export default auditRouter;
