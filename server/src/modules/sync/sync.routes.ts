import { Router, type NextFunction, type Request, type Response } from "express";
import { resolveScope } from "../auth/scope.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../../middlewares/auth.middleware.js";
import { handleSyncAttendance } from "./sync.controller.js";

const syncRouter = Router();

// Any signed-in user may sync their own offline attendance. The downstream
// attendance services enforce per-record scope/authorization.
syncRouter.use(requireAuth);
syncRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    authed.scope = authed.scope ?? (await resolveScope(authed.userId));
    next();
  } catch (err) {
    next(err);
  }
});

syncRouter.post("/attendance", handleSyncAttendance);

export default syncRouter;
