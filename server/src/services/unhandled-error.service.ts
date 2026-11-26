import type { Request } from "express";
import { logger } from "../config/logger.js";
import { captureError } from "../config/sentry.js";
import { notifySystemAdmin500Error } from "../modules/notifications/error-alerter.js";
import { recordSystemError } from "../modules/system-errors/system-error.service.js";

/**
 * Central "unhandled 500" handler used by the Express error middleware.
 *
 * It coordinates the cross-cutting reactions to an unexpected server error:
 *   1. report to Sentry (no-op unless SENTRY_DSN is configured),
 *   2. persist to `system_error_logs`,
 *   3. alert the System Admin via Web Push / in-app critical notification.
 *
 * Keeping this coordination in one service means the error middleware has a
 * single dependency instead of reaching into feature modules directly (lower
 * coupling, higher cohesion).
 */
export async function reportUnhandledServerError(
  err: unknown,
  req: Request,
): Promise<void> {
  const reqId = (req as { id?: string })?.id;
  const user = (req as { userId?: string })?.userId;

  captureError(err, {
    requestId: reqId,
    path: req?.originalUrl || req?.url,
    method: req?.method,
    userId: user,
  });

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
    logger.error(
      { recordErr },
      "Failed to record system error and dispatch alert",
    );
  }
}
