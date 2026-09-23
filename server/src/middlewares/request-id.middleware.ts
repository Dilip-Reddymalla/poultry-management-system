import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existingId = req.headers["x-request-id"];
  const requestId =
    typeof existingId === "string" && existingId.trim().length > 0
      ? existingId.trim()
      : crypto.randomUUID();

  req.id = requestId;
  req.log = logger.child({ requestId });
  res.setHeader("X-Request-Id", requestId);

  next();
}
