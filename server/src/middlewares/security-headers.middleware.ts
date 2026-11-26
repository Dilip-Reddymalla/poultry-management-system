import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

/**
 * Security hardening response headers applied to every request.
 *
 * - `X-Content-Type-Options: nosniff` — blocks MIME sniffing.
 * - `X-Frame-Options: DENY` — prevents clickjacking (the SPA is never framed).
 * - `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage.
 * - `Permissions-Policy` — explicitly gates powerful browser features; camera and
 *   geolocation stay `self` because the Face AI attendance flow uses them.
 * - `Strict-Transport-Security` (HSTS) — set only over HTTPS/production so plain
 *   HTTP local development is not accidentally locked out.
 * - `Content-Security-Policy` — applied only in production; the Vite dev server
 *   relies on inline/react-refresh scripts, so a policy would break development.
 *   The default is a working SPA policy; tune via the SECURITY_CSP env var.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  );

  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

  if (env.NODE_ENV === "production" && isSecure) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  if (env.NODE_ENV === "production") {
    const csp =
      env.SECURITY_CSP ||
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ");
    res.setHeader("Content-Security-Policy", csp);
  }

  next();
}
