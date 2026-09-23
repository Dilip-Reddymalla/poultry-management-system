import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";
import { REFRESH_TOKEN_TTL_MS } from "./refresh-token.js";

export const REFRESH_COOKIE_NAME = "poultry_refresh";

const isProduction = env.NODE_ENV === "production";

const baseRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/api/auth",
};

export const refreshCookieOptions: CookieOptions = {
  ...baseRefreshCookieOptions,
  maxAge: REFRESH_TOKEN_TTL_MS,
};

export const clearRefreshCookieOptions: CookieOptions = baseRefreshCookieOptions;

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions);
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
}
