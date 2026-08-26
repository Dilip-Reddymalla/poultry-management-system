import jwt from "jsonwebtoken";

import {env} from "../config/env.js";

export interface AuthTokenPayload{
    sub: string;
}

// Single source of truth for the session lifetime: the JWT expiry and the auth
// cookie maxAge are both derived from it so they can never drift apart.
export const AUTH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function generateAccessToken(userId:string):string{
    const payload: AuthTokenPayload = {
        sub: userId,
    };
    return jwt.sign(payload,env.JWT_SECRET,{
        expiresIn: AUTH_TOKEN_TTL_MS / 1000,
    });
}


export function verifyAccessToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.sub !== "string"
  ) {
    throw new Error("Invalid authentication token");
  }

  return {
    sub: decoded.sub,
  };
}