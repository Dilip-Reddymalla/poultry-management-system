import { Router } from "express";

import {
  loginController,
  faceLoginController,
  selectFaceUserController,
  phoneLoginController,
  getCurrentUserController,
  updateCurrentUserPhotoController,
  logoutController,
  requestOtpController,
  verifyOtpController,
  selectPhoneUserController,
  setPasswordController,
  changePasswordController,
  resetPasswordController,
  refreshTokenController,
  logoutAllController,
  listSessionsController,
  revokeSessionController,
} from "./auth.controller.js";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { uploadPhoto } from "../../middlewares/upload.middleware.js";
import {
  authEndpointRateLimiter,
  tokenRefreshRateLimiter,
} from "../../middlewares/rate-limit.middleware.js";

const router = Router();

router.post("/login", authEndpointRateLimiter, loginController);
router.post("/face/login", authEndpointRateLimiter, uploadPhoto, faceLoginController);
router.post("/face/select-user", authEndpointRateLimiter, selectFaceUserController);
router.post("/phone/login", authEndpointRateLimiter, phoneLoginController);
router.post("/refresh", tokenRefreshRateLimiter, refreshTokenController);
router.get("/me", requireAuth, getCurrentUserController);
router.patch("/me/photo", requireAuth, uploadPhoto, updateCurrentUserPhotoController);
router.post("/logout", logoutController);
router.post("/logout-all", requireAuth, logoutAllController);
router.get("/sessions", requireAuth, listSessionsController);
router.delete("/sessions/:id", requireAuth, revokeSessionController);
router.post("/phone/request-otp", authEndpointRateLimiter, requestOtpController);
router.post("/phone/verify-otp", authEndpointRateLimiter, verifyOtpController);
router.post("/phone/select-user", authEndpointRateLimiter, selectPhoneUserController);
// Only requireAuth (not requirePermission): a first-login session is restricted
// from every business endpoint but must be able to reach this one to leave that
// state. setPassword itself rejects any account not in the mustSetPassword state.
router.post("/set-password", requireAuth, setPasswordController);
router.post("/change-password", requireAuth, changePasswordController);
router.post("/reset-password", authEndpointRateLimiter, resetPasswordController);

export default router;

