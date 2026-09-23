import crypto from "crypto";
import jwt from "jsonwebtoken";
import { refreshTokenSecret } from "../config/env.js";

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface RefreshTokenPayload {
  sub?: string | undefined;
  isSystemAdmin?: boolean | undefined;
  jti: string; // Unique token identifier for anti-collision
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(options: {
  userId?: string;
  isSystemAdmin?: boolean;
}): { token: string; tokenHash: string; expiresAt: Date } {
  const jti = crypto.randomUUID();
  const payload: RefreshTokenPayload = {
    jti,
    ...(options.userId ? { sub: options.userId } : {}),
    ...(options.isSystemAdmin ? { isSystemAdmin: true } : {}),
  };

  const token = jwt.sign(payload, refreshTokenSecret, {
    expiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
  });

  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  return { token, tokenHash, expiresAt };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, refreshTokenSecret);

  if (typeof decoded !== "object" || decoded === null || typeof decoded.jti !== "string") {
    throw new Error("Invalid refresh token");
  }

  return {
    sub: typeof decoded.sub === "string" ? decoded.sub : undefined,
    isSystemAdmin: decoded.isSystemAdmin === true,
    jti: decoded.jti,
  };
}
