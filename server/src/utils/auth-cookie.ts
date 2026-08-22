import type { CookieOptions } from "express";

import { env } from "../config/env.js";
import { AUTH_TOKEN_TTL_MS } from "./jwt.js";

// The session cookie name is shared by every endpoint that sets or clears it and
// by requireAuth, which reads it back.
export const AUTH_COOKIE_NAME = "poultry_auth";

// Flags live in one place so a cookie set by one login path can never differ
// from another (or from the cookie logout tries to clear — the browser only
// removes a cookie when the flags match).
//
// httpOnly: the token is never readable from JavaScript, so XSS cannot exfiltrate it.
// secure: HTTPS-only outside development; localhost development is plain HTTP.
// sameSite lax: the SPA calls the API cross-origin but same-site (different port
// in development, sibling subdomain in production), which lax permits, while
// still blocking cookie-bearing requests from unrelated sites. Deploying the API
// on a different registrable domain than the SPA would require sameSite=none —
// a deliberate security decision, not a silent default.
const baseAuthCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

// maxAge tracks the JWT lifetime so the cookie and the token expire together.
export const authCookieOptions: CookieOptions = {
  ...baseAuthCookieOptions,
  maxAge: AUTH_TOKEN_TTL_MS,
};

export const clearAuthCookieOptions: CookieOptions = baseAuthCookieOptions;
