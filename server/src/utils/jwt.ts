import jwt from "jsonwebtoken";

import {env} from "../config/env.js";

export interface AuthTokenPayload{
    sub: string;
}

const JWT_EXPIRES_IN = '1h';

export function generateAccessToken(userId:string):string{
    const payload: AuthTokenPayload = {
        sub: userId,
    };
    return jwt.sign(payload,env.JWT_SECRET,{
        expiresIn:JWT_EXPIRES_IN,
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