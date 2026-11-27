import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { processFacePhoto } from "../employee/employee.controller.js";
import { updateEmployeePhotoById } from "../employee/employee.service.js";
import { updateSystemAdminBiometrics } from "./system-admin.js";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  clearAuthCookieOptions,
} from "../../utils/auth-cookie.js";
import {
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../../utils/refresh-cookie.js";
import {
  getCurrentUser,
  login,
  loginWithFace,
  loginWithPhone,
  requestOtp,
  verifyPhoneOtp,
  selectPhoneUser,
  selectFaceUser,
  setPassword,
  changePassword,
  resetPasswordWithOtp,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  listActiveSessions,
  revokeSession,
} from "./auth.service.js";
import {
  loginSchema,
  phoneLoginSchema,
  requestOtpSchema,
  verifyOtpSchema,
  selectPhoneUserSchema,
  selectFaceUserSchema,
  setPasswordSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "./auth.schema.js";

export async function loginController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = loginSchema.parse(req.body);

  const result = await login(input);

  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);
  setRefreshTokenCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Login successful",
    user: result.user,
  });
}

export async function faceLoginController(
  req: Request,
  res: Response,
): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError("Face photo is required", 400);
  }

  const result = await loginWithFace(file.buffer, file.originalname);

  if (result.requiresUserSelection) {
    res.status(200).json({
      success: true,
      message: "Face verified. Select an account.",
      requiresUserSelection: true,
      selectionToken: result.selectionToken,
      users: result.accounts,
    });
    return;
  }

  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);
  setRefreshTokenCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Face login successful",
    requiresUserSelection: false,
    user: result.user,
    similarity: result.similarity,
  });
}

export async function selectFaceUserController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = selectFaceUserSchema.parse(req.body);

  const result = await selectFaceUser(input.selectionToken, input.accountId);

  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);
  setRefreshTokenCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Face login successful",
    requiresUserSelection: false,
    user: result.user,
  });
}

export async function phoneLoginController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = phoneLoginSchema.parse(req.body);

  const result = await loginWithPhone(input);

  if (result.requiresUserSelection) {
    res.status(200).json({
      success: true,
      message: "Credentials verified. Select an account.",
      requiresUserSelection: true,
      selectionToken: result.selectionToken,
      users: result.users,
    });
    return;
  }

  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);
  setRefreshTokenCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Login successful",
    requiresUserSelection: false,
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

export async function updateCurrentUserPhotoController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const file = req.file;

  if (!file) {
    throw new AppError("Photo file is required", 400);
  }

  const currentUser = await getCurrentUser(authReq.userId);
  if (currentUser.isSystemAdmin) {
    const faceData = await processFacePhoto(file, "system-admin/profiles");
    await updateSystemAdminBiometrics(faceData.photoUrl, faceData.faceEmbedding);
  } else if (currentUser.employee?.id) {
    const faceData = await processFacePhoto(file, "employees/profiles");
    await updateEmployeePhotoById(currentUser.employee.id, faceData);
  } else {
    throw new AppError("No employee profile found for this account", 400);
  }

  const updatedUser = await getCurrentUser(authReq.userId);

  res.status(200).json({
    success: true,
    user: updatedUser,
  });
}

export async function logoutController(
  req: Request,
  res: Response,
): Promise<void> {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof refreshToken === "string") {
    await revokeRefreshToken(refreshToken);
  }

  res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions);
  clearRefreshTokenCookie(res);

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
}

export async function logoutAllController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  await revokeAllUserRefreshTokens(authReq.userId);

  res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions);
  clearRefreshTokenCookie(res);

  res.status(200).json({
    success: true,
    message: "Logged out from all sessions successfully",
  });
}

export async function refreshTokenController(
  req: Request,
  res: Response,
): Promise<void> {
  const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
  const tokenFromBody =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  const refreshToken = tokenFromCookie || tokenFromBody;

  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(401).json({
      success: false,
      message: "Refresh token is required",
    });
    return;
  }

  const result = await rotateRefreshToken(refreshToken);

  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);
  setRefreshTokenCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Token refreshed successfully",
    user: result.user,
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
  setRefreshTokenCookie(res, result.refreshToken);

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
  setRefreshTokenCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Login successful",
    user: result.user,
  });
}

export async function setPasswordController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  const input = setPasswordSchema.parse(req.body);

  const result = await setPassword(authReq.userId, input.password);

  // Rotate the session so the account leaves the restricted first-login state
  // without needing to sign in again.
  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);
  setRefreshTokenCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Password set successfully",
    user: result.user,
  });
}

export async function changePasswordController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const input = changePasswordSchema.parse(req.body);

  const result = await changePassword(authReq.userId, input);

  res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);
  setRefreshTokenCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Password changed successfully",
    user: result.user,
  });
}

export async function resetPasswordController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = resetPasswordSchema.parse(req.body);

  const result = await resetPasswordWithOtp(input);

  res.status(200).json({
    success: true,
    message: result.message,
  });
}

export async function listSessionsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const sessions = await listActiveSessions(authReq.userId);

  res.status(200).json({ success: true, sessions });
}

export async function revokeSessionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const id = String(req.params.id);

  await revokeSession(authReq.userId, id);

  res.status(200).json({
    success: true,
    message: "Session revoked",
  });
}