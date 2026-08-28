import { Router, type NextFunction, type Request, type Response } from "express";
import { resolveScope } from "../auth/scope.js";
import { requireAuth, type AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { handleListAuditLogs, handleExportAuditLogs } from "./audit.controller.js";

const auditRouter = Router();

// Require logged-in user and System Admin role
auditRouter.use(requireAuth);
auditRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = (req as AuthenticatedRequest).scope ?? (await resolveScope((req as AuthenticatedRequest).userId));
    (req as AuthenticatedRequest).scope = scope;
    if (!scope.isSystemAdmin) {
      return next(new AppError("Only System Administrator can access audit logs", 403));
    }
    next();
  } catch (err) {
    next(err);
  }
});

auditRouter.get("/", handleListAuditLogs);
auditRouter.get("/export", handleExportAuditLogs);

export default auditRouter;
