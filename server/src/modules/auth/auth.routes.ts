import { Router } from "express";

import {
  loginController,
  getCurrentUserController,
  logoutController,
  requestOtpController,
  verifyOtpController,
  selectPhoneUserController,
  setPasswordController,
} from "./auth.controller.js";

import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", loginController);
router.get("/me", requireAuth, getCurrentUserController);
router.post("/logout", logoutController);
router.post("/phone/request-otp", requestOtpController);
router.post("/phone/verify-otp", verifyOtpController);
router.post("/phone/select-user", selectPhoneUserController);
// Only requireAuth (not requirePermission): a first-login session is restricted
// from every business endpoint but must be able to reach this one to leave that
// state. setPassword itself rejects any account not in the mustSetPassword state.
router.post("/set-password", requireAuth, setPasswordController);


export default router;
