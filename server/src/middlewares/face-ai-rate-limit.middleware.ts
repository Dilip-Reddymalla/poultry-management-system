import rateLimit, { type Options } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { getClientIp, getAuthenticatedUserId } from "./rate-limit.middleware.js";
import { env } from "../config/env.js";

const shouldSkipInTest = (): boolean => {
  return env.NODE_ENV === "test" && process.env.ENABLE_RATE_LIMIT_TEST !== "true";
};

export const faceAiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  limit: (req: Request) => {
    const userId = getAuthenticatedUserId(req);
    // Logged in users get 60 requests/min; anonymous gets 20 requests/min
    return userId ? 60 : 20;
  },
  keyGenerator: (req: Request) => {
    const userId = getAuthenticatedUserId(req);
    if (userId) {
      return `face-ai:user:${userId}`;
    }
    return `face-ai:ip:${getClientIp(req)}`;
  },
  standardHeaders: "draft-7", // draft-7 sends RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset (seconds)
  legacyHeaders: false,
  skip: () => shouldSkipInTest(),
  handler: (req: Request, res: Response, _next: NextFunction, _options: Options) => {
    const isAuth = !!getAuthenticatedUserId(req);
    const limit = isAuth ? 60 : 20;
    const retryAfter = res.getHeader("Retry-After") || 60;

    res.status(429).json({
      success: false,
      error: "RATE_LIMIT_EXCEEDED",
      message: isAuth
        ? `Demo rate limit exceeded (${limit} requests per minute). Please wait ${retryAfter}s before trying again.`
        : `Demo rate limit exceeded (${limit} requests per minute for public guests). Please sign in for higher limits (60/min) or wait ${retryAfter}s.`,
      retryAfter: Number(retryAfter) || 60,
      limit,
    });
  },
  validate: { xForwardedForHeader: false, default: false },
});
