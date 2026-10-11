import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { resolveScope } from "../auth/scope.js";
import { AppError } from "../../utils/app-error.js";
import {
  listSystemErrors,
  getSystemErrorById,
  markSystemErrorResolved,
} from "./system-error.service.js";

const systemErrorRouter = Router();

// Strictly enforce System Admin role only
systemErrorRouter.use(requireAuth);
systemErrorRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const scope = authReq.scope ?? (await resolveScope(authReq.userId));
    authReq.scope = scope;
    if (!scope.isSystemAdmin) {
      return next(new AppError("Access restricted. Only System Administrators can inspect system error logs.", 403));
    }
    next();
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/system-errors
systemErrorRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listSystemErrors({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      errorName: typeof req.query.errorName === "string" ? req.query.errorName : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/system-errors/:id
systemErrorRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errorId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!errorId) {
      return next(new AppError("Missing error ID parameter", 400));
    }
    const errorLog = await getSystemErrorById(errorId);
    if (!errorLog) {
      return next(new AppError("System error log entry not found", 404));
    }
    res.json({ success: true, data: errorLog });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/system-errors/:id/resolve
systemErrorRouter.patch("/:id/resolve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errorId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!errorId) {
      return next(new AppError("Missing error ID parameter", 400));
    }
    const resolvedBy = "System Administrator";
    const updated = await markSystemErrorResolved(errorId, resolvedBy);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export { systemErrorRouter };
