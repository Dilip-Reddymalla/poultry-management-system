import type { CookieOptions, Request, Response } from "express";

import { env } from "../config/env.js";
import { AUTH_TOKEN_TTL_MS } from "./jwt.js";

// The session cookie name is shared by every endpoint that sets or clears it and
// by requireAuth, which reads it back.
export const AUTH_COOKIE_NAME = "poultry_auth";

const isProduction = env.NODE_ENV === "production";

// Hostnames the SPA is served from. When an API request arrives with one of
// these as its Host, it came through the same-origin reverse proxy (Apple/Safari
// path) and its cookies must be first-party (SameSite=Lax). Direct cross-origin
// requests (other browsers) must use SameSite=None.
const clientHostnames = new Set(
  (env.CLIENT_ORIGIN || "")
    .split(",")
    .map((o) => {
      try {
        return new URL(o.trim()).hostname;
      } catch {
        return "";
      }
    })
    .filter(Boolean),
);

export function isSameOriginRequest(req: Request): boolean {
  return clientHostnames.has(req.hostname ?? "");
}

function baseAuthCookieOptions(sameOrigin: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: sameOrigin ? "lax" : "none",
    path: "/",
  };
}

export function getAuthCookieOptions(res: Response): CookieOptions {
  const sameOrigin = res.locals?.sameOriginAuth === true;
  return {
    ...baseAuthCookieOptions(sameOrigin),
    maxAge: AUTH_TOKEN_TTL_MS,
  };
}

export function getClearAuthCookieOptions(res: Response): CookieOptions {
  const sameOrigin = res.locals?.sameOriginAuth === true;
  return baseAuthCookieOptions(sameOrigin);
}
