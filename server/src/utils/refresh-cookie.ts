import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";
import { REFRESH_TOKEN_TTL_MS } from "./refresh-token.js";

export const REFRESH_COOKIE_NAME = "poultry_refresh";

const isProduction = env.NODE_ENV === "production";

function refreshCookieOptions(sameOrigin: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: sameOrigin ? "lax" : "none",
    path: "/api/auth",
  };
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  const sameOrigin = res.locals?.sameOriginAuth === true;
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions(sameOrigin),
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  const sameOrigin = res.locals?.sameOriginAuth === true;
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(sameOrigin));
}
