import * as Sentry from "@sentry/node";
import { env } from "./env.js";

/**
 * Optional Sentry integration.
 *
 * Sentry is only enabled when a SENTRY_DSN is configured. Without it, all of
 * these calls are no-ops, so local development and tests are unaffected.
 */
let enabled = false;

export function initSentry(): void {
  const dsn = env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: 0.2,
  });

  enabled = true;
}

export function isSentryEnabled(): boolean {
  return enabled;
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) {
    return;
  }
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
