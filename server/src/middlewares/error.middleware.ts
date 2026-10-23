import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";

import { notifySystemAdmin500Error } from "../modules/notifications/error-alerter.js";
import { recordSystemError } from "../modules/system-errors/system-error.service.js";

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

  // Handle malformed JSON request body from body-parser
  if (err instanceof SyntaxError && "status" in err && (err as { status?: number }).status === 400 && "body" in err) {
    res.status(400).json({
      success: false,
      message: "Malformed JSON payload in request body",
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

  // Handle client-initiated connection aborts (e.g. mobile camera frame upload cancelled)
  const isClientAbort =
    (err as Error)?.message === "Request aborted" ||
    (err as { code?: string })?.code === "ECONNABORTED" ||
    (err as { code?: string })?.code === "ERR_HTTP_REQUEST_ABORTED";

  if (isClientAbort) {
    reqLogger.warn(
      { path: req?.originalUrl || req?.url },
      "Client aborted request mid-flight",
    );

    if (!res.headersSent) {
      res.status(400).json({
        success: false,
        message: "Client closed connection before request could complete",
      });
    }

    return;
  }

  // Handle database connection timeouts (e.g. Neon serverless wake-up)
  const isDbConnectionTimeout =
    typeof (err as Error)?.message === "string" &&
    (err as Error).message.includes("timeout exceeded when trying to connect");

  if (isDbConnectionTimeout) {
    reqLogger.error(
      { err, path: req?.originalUrl || req?.url },
      "Database connection timed out during serverless wake-up / high load",
    );

    res.status(503).json({
      success: false,
      message: "Database temporarily unavailable while connecting. Please retry.",
    });

    return;
  }

  // Only genuinely unexpected failures are logged, so the log stays a signal of
  // real defects rather than a stream of ordinary validation/permission noise.
  reqLogger.error({ err, path: req?.originalUrl || req?.url }, "Unhandled internal server error");

  // Record into system_error_logs and alert System Admin via Web Push and in-app critical alert
  const reqId = (req as { id?: string })?.id;
  const user = (req as { userId?: string })?.userId;
  void (async () => {
    try {
      const errorLog = await recordSystemError({ err, req, statusCode: 500 });
      await notifySystemAdmin500Error({
        path: req?.originalUrl || req?.url || "unknown",
        method: req?.method || "UNKNOWN",
        errorName: (err as Error)?.name || "Error",
        errorMessage: (err as Error)?.message || "Internal server error",
        requestId: reqId,
        userId: user,
        systemErrorId: errorLog?.id,
      });
    } catch (recordErr) {
      reqLogger.error({ recordErr }, "Failed to record system error and dispatch alert");
    }
  })();

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
