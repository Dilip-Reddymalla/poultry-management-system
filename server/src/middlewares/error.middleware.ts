import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";

// Prisma error codes that represent an expected client-caused outcome. Modules
// normally translate their own constraint violations into a domain message; this
// map is the safety net so an untranslated one still reaches the frontend as a
// meaningful 4xx instead of a 500. Messages are deliberately generic — Prisma's
// `meta` carries table and column names and is never forwarded.
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2000: { status: 400, message: "A provided value is too long" },
  P2002: { status: 409, message: "A record with these values already exists" },
  P2003: { status: 409, message: "Related record constraint failed" },
  P2025: { status: 404, message: "Record not found" },
};

export const errorMiddleware: ErrorRequestHandler = (
  err,
  req,
  res,
  _next,
) => {
  const reqLogger = req?.log || logger;

  if (err instanceof z.ZodError) {
    // fieldErrors stays under `errors` (unchanged contract); formErrors carries
    // object-level issues that belong to no single field.
    const flattened = z.flattenError(err);

    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
    });

    return;
  }

  if (err instanceof AppError) {
    const errorPayload = {
      path: req?.originalUrl || req?.url,
      statusCode: err.statusCode,
      err,
    };

    if (err.statusCode >= 500) {
      reqLogger.error(errorPayload, `[AppError ${err.statusCode}] ${err.message}`);
    } else {
      reqLogger.warn(errorPayload, `[AppError ${err.statusCode}] ${err.message}`);
    }

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details ? err.details : {}),
    });

    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_ERROR_MAP[err.code];

    if (mapped) {
      res.status(mapped.status).json({
        success: false,
        message: mapped.message,
      });

      return;
    }
  }

  // Only genuinely unexpected failures are logged, so the log stays a signal of
  // real defects rather than a stream of ordinary validation/permission noise.
  reqLogger.error({ err, path: req?.originalUrl || req?.url }, "Unhandled internal server error");

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
