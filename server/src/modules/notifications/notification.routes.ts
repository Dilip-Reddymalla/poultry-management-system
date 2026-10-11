import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  getVapidKeyController,
  subscribePushController,
  unsubscribePushController,
  listNotificationsController,
  markReadController,
  markAllReadController,
} from "./notification.controller.js";

const router = Router();

// Public: get VAPID public key for frontend subscription registration
router.get("/vapid-key", getVapidKeyController);

// Authenticated routes: manage device subscriptions and in-app notifications
router.use(requireAuth);

router.post("/subscribe", subscribePushController);
router.post("/unsubscribe", unsubscribePushController);
router.get("/", listNotificationsController);
router.patch("/:id/read", markReadController);
router.post("/read-all", markAllReadController);

export { router as notificationRoutes };
