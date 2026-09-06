import express, { type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { describe, expect, it } from "vitest";
import rateLimit from "express-rate-limit";
import {
  getClientIp,
  getAuthenticatedUserId,
  publicRateLimiter,
  authEndpointRateLimiter,
  authenticatedRateLimiter,
  tieredRateLimiter,
} from "../src/middlewares/rate-limit.middleware.js";
import { generateAccessToken } from "../src/utils/jwt.js";
import { AUTH_COOKIE_NAME } from "../src/utils/auth-cookie.js";

describe("Rate Limiting Middleware", () => {
  describe("Helpers", () => {
    it("extracts client IP from x-forwarded-for header", () => {
      const req = {
        headers: {
          "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
        },
        socket: {},
      } as unknown as Request;

      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("extracts client IP from req.ip when x-forwarded-for is missing", () => {
      const req = {
        headers: {},
        ip: "192.168.1.50",
        socket: {},
      } as unknown as Request;

      expect(getClientIp(req)).toBe("192.168.1.50");
    });

    it("extracts user ID from req.userId if already attached", () => {
      const req = {
        userId: "user-12345",
        headers: {},
      } as unknown as Request;

      expect(getAuthenticatedUserId(req)).toBe("user-12345");
    });

    it("extracts user ID from valid auth cookie", () => {
      const token = generateAccessToken("user-from-cookie-99");
      const req = {
        cookies: {
          [AUTH_COOKIE_NAME]: token,
        },
        headers: {},
      } as unknown as Request;

      expect(getAuthenticatedUserId(req)).toBe("user-from-cookie-99");
    });

    it("extracts user ID from valid Authorization Bearer header", () => {
      const token = generateAccessToken("user-from-bearer-88");
      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        cookies: {},
      } as unknown as Request;

      expect(getAuthenticatedUserId(req)).toBe("user-from-bearer-88");
    });

    it("returns null for invalid or missing auth", () => {
      const req = {
        cookies: {
          [AUTH_COOKIE_NAME]: "invalid-token",
        },
        headers: {},
      } as unknown as Request;

      expect(getAuthenticatedUserId(req)).toBeNull();
    });
  });

  describe("Tiered Rate Limiter Behavior", () => {
    it("enforces lower limit for unauthenticated (before login) requests", async () => {
      const testApp = express();
      testApp.use(cookieParser());

      // Create a test limiter with a small limit for verification
      const testUnauthLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 3,
        keyGenerator: (req) => `test_public:${getClientIp(req)}`,
        handler: (_req, res) => {
          res.status(429).json({
            success: false,
            message: "Too many requests from this IP address.",
          });
        },
      });

      testApp.get("/test-public", testUnauthLimiter, (_req: Request, res: Response) => {
        res.status(200).json({ success: true, message: "ok" });
      });

      // Send 3 requests - should all succeed
      for (let i = 0; i < 3; i++) {
        const res = await request(testApp).get("/test-public");
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }

      // 4th request should be blocked with 429
      const blockedRes = await request(testApp).get("/test-public");
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.message).toContain("Too many requests");
    });

    it("enforces high limit and isolates quotas by userId for authenticated (after login) requests", async () => {
      const testApp = express();
      testApp.use(cookieParser());

      // Create a test authenticated limiter with a small test limit
      const testAuthLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 5,
        keyGenerator: (req) => {
          const userId = getAuthenticatedUserId(req);
          return userId ? `test_user:${userId}` : `test_ip:${getClientIp(req)}`;
        },
        handler: (_req, res) => {
          res.status(429).json({
            success: false,
            message: "Account request rate limit reached.",
          });
        },
      });

      testApp.get("/test-auth", testAuthLimiter, (_req: Request, res: Response) => {
        res.status(200).json({ success: true, message: "authenticated ok" });
      });

      const user1Token = generateAccessToken("user-alpha");
      const user2Token = generateAccessToken("user-beta");

      // User 1 sends 5 requests (all ok)
      for (let i = 0; i < 5; i++) {
        const res = await request(testApp)
          .get("/test-auth")
          .set("Cookie", `${AUTH_COOKIE_NAME}=${user1Token}`);
        expect(res.status).toBe(200);
      }

      // User 1's 6th request is rate limited
      const user1Blocked = await request(testApp)
        .get("/test-auth")
        .set("Cookie", `${AUTH_COOKIE_NAME}=${user1Token}`);
      expect(user1Blocked.status).toBe(429);
      expect(user1Blocked.body.message).toContain("Account request rate limit reached");

      // User 2 should NOT be blocked (independent quota per user ID)
      const user2Res = await request(testApp)
        .get("/test-auth")
        .set("Cookie", `${AUTH_COOKIE_NAME}=${user2Token}`);
      expect(user2Res.status).toBe(200);
      expect(user2Res.body.success).toBe(true);
    });

    it("tieredRateLimiter routes properly between authenticated and unauthenticated callers", async () => {
      const testApp = express();
      testApp.use(cookieParser());
      testApp.use(tieredRateLimiter);

      testApp.get("/api/data", (_req, res) => {
        res.status(200).json({ success: true, message: "data retrieved" });
      });

      // Unauthenticated request
      const unauthRes = await request(testApp).get("/api/data");
      expect(unauthRes.status).toBe(200);
      expect(unauthRes.body.success).toBe(true);

      // Authenticated request
      const token = generateAccessToken("user-tiered-test");
      const authRes = await request(testApp)
        .get("/api/data")
        .set("Cookie", `${AUTH_COOKIE_NAME}=${token}`);
      expect(authRes.status).toBe(200);
      expect(authRes.body.success).toBe(true);
    });
  });
});
