import rateLimit, { type Options } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE_NAME } from "../utils/auth-cookie.js";
import { verifyAccessToken } from "../utils/jwt.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";
import { env } from "../config/env.js";

/**
 * Extracts client IP safely across proxies and direct connections.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0];
    if (first) {
      return first.trim();
    }
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}


/**
 * Attempts to resolve the authenticated user's ID from req.userId,
 * auth cookies, or Authorization header (Bearer token).
 * Returns null if not authenticated or token is invalid.
 */
export function getAuthenticatedUserId(req: Request): string | null {
  if ((req as AuthenticatedRequest).userId) {
    return (req as AuthenticatedRequest).userId;
  }

  // Check auth cookie
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken && typeof cookieToken === "string") {
    try {
      const payload = verifyAccessToken(cookieToken);
      return payload.sub;
    } catch {
      // Invalid/expired token -> treat as unauthenticated
    }
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.substring(7).trim();
    try {
      const payload = verifyAccessToken(bearerToken);
      return payload.sub;
    } catch {
      // Invalid/expired token -> treat as unauthenticated
    }
  }

  return null;
}

const standardJsonHandler = (
  _req: Request,
  res: Response,
  _next: NextFunction,
  options: Options,
) => {
  res.status(options.statusCode).json({
    success: false,
    message: options.message,
  });
};

const shouldSkipInTest = (): boolean => {
  return env.NODE_ENV === "test" && process.env.ENABLE_RATE_LIMIT_TEST !== "true";
};

/**
 * 1. Before Login / Public Rate Limiter:
 * Stricter limit applied per client IP (default: 60 requests / 15 minutes).
 */
export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => shouldSkipInTest(),
  keyGenerator: (req) => `public:${getClientIp(req)}`,
  handler: standardJsonHandler,
  message: "Too many requests from this IP address. Please try again after 15 minutes.",
  validate: { xForwardedForHeader: false },
});

/**
 * 2. Sensitive Auth Endpoints Rate Limiter (Before Login):
 * Extra strict limit on login and OTP generation/verification (default: 15 requests / 15 minutes).
 */
export const authEndpointRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => shouldSkipInTest(),
  keyGenerator: (req) => `auth:${getClientIp(req)}`,
  handler: standardJsonHandler,
  message: "Too many authentication or verification attempts. Please try again after 15 minutes.",
  validate: { xForwardedForHeader: false },
});

/**
 * 3. After Login / Authenticated Rate Limiter:
 * High limit applied per authenticated user account (default: 1000 requests / 15 minutes).
 */
export const authenticatedRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => shouldSkipInTest(),
  keyGenerator: (req) => {
    const userId = getAuthenticatedUserId(req);
    return userId ? `auth_user:${userId}` : `auth_ip:${getClientIp(req)}`;
  },
  handler: standardJsonHandler,
  message: "Account request rate limit reached. Please slow down and try again later.",
  validate: { xForwardedForHeader: false },
});

/**
 * 4. Tiered API Rate Limiter:
 * Automatically routes to high limit for logged-in users, or stricter limit for unauthenticated users.
 */
export function tieredRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = getAuthenticatedUserId(req);
  if (userId) {
    authenticatedRateLimiter(req, res, next);
  } else {
    publicRateLimiter(req, res, next);
  }
}
