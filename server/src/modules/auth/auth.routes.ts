import { Router } from "express";

import {
  loginController,
  getCurrentUserController,
  logoutController,
  requestOtpController,
  verifyOtpController,
  selectPhoneUserController,
} from "./auth.controller.js";

import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", loginController);
router.get("/me", requireAuth, getCurrentUserController);
router.post("/logout", logoutController);
router.post("/phone/request-otp", requestOtpController);
router.post("/phone/verify-otp", verifyOtpController);
router.post("/phone/select-user", selectPhoneUserController);


export default router;
