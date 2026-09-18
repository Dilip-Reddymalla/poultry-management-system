import { Router } from "express";

import {
  loginController,
  phoneLoginController,
  getCurrentUserController,
  logoutController,
  requestOtpController,
  verifyOtpController,
  selectPhoneUserController,
  setPasswordController,
  changePasswordController,
  resetPasswordController,
} from "./auth.controller.js";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { authEndpointRateLimiter } from "../../middlewares/rate-limit.middleware.js";

const router = Router();

router.post("/login", authEndpointRateLimiter, loginController);
router.post("/phone/login", authEndpointRateLimiter, phoneLoginController);
router.get("/me", requireAuth, getCurrentUserController);
router.post("/logout", logoutController);
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

