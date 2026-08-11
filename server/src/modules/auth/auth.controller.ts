import type { Request, Response } from "express";
import {env} from "../../config/env.js";

import { login } from "./auth.service.js";
import { loginSchema } from "./auth.schema.js";

const AUTH_COOKIE_NAME = "poultry_auth";

export async function loginController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = loginSchema.parse(req.body);

  const result = await login(input);

  res.cookie(AUTH_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 1000,
    path: "/",
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    user: result.user,
  });
}