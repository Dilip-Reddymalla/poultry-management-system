import type { NextFunction, Request, Response } from "express";

import { AUTH_COOKIE_NAME } from "../utils/auth-cookie.js";
import { verifyAccessToken } from "../utils/jwt.js";
import type { AuthScope } from "../modules/auth/scope.js";

export interface AuthenticatedRequest extends Request {
  userId: string;
  // Populated by the authorize middleware once resolved, so a controller behind
  // requirePermission can read the caller's scope without a second lookup.
  scope?: AuthScope;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token || typeof token !== "string") {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    (req as AuthenticatedRequest).userId = payload.sub;

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}