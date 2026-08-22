import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  clearAuthCookieOptions,
} from "../../utils/auth-cookie.js";

import { getCurrentUser, login, requestOtp,verifyPhoneOtp, selectPhoneUser } from "./auth.service.js";
import { loginSchema, requestOtpSchema, verifyOtpSchema, selectPhoneUserSchema } from "./auth.schema.js";


export async function loginController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = loginSchema.parse(req.body);

  const result = await login(input);

  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);

  res.status(200).json({
    success: true,
    message: "Login successful",
    user: result.user,
  });
}

export async function getCurrentUserController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  const user = await getCurrentUser(authReq.userId);

  res.status(200).json({
    success: true,
    user,
  });
}
export async function logoutController(
  _req: Request,
  res: Response,
): Promise<void> {
  res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions);

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
}


export async function requestOtpController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = requestOtpSchema.parse(req.body);

  const result = await requestOtp(input.phone);

  res.status(200).json({
    success: true,
    message: "OTP sent successfully",
    phone: result.phone,
  });
}

export async function verifyOtpController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = verifyOtpSchema.parse(req.body);

  const result = await verifyPhoneOtp(
    input.phone,
    input.otp,
  );

  if (result.requiresUserSelection) {
    res.status(200).json({
      success: true,
      message: "OTP verified. Select an account.",
      requiresUserSelection: true,
      selectionToken: result.selectionToken,
      users: result.users,
    });

    return;
  }

  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);

  res.status(200).json({
    success: true,
    message: "Login successful",
    requiresUserSelection: false,
    user: result.user,
  });
}

export async function selectPhoneUserController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = selectPhoneUserSchema.parse(req.body);

  const result = await selectPhoneUser(
    input.selectionToken,
    input.userId,
  );

  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);

  res.status(200).json({
    success: true,
    message: "Login successful",
    user: result.user,
  });
}