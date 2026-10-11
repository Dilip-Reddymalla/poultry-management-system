import webpush from "web-push";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

let isVapidConfigured = false;

export function initializeWebPush(): void {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT) {
    try {
      webpush.setVapidDetails(
        env.VAPID_SUBJECT,
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY,
      );
      isVapidConfigured = true;
      logger.info("✅ Web Push VAPID details configured successfully");
    } catch (error) {
      logger.error({ error }, "❌ Failed to configure Web Push VAPID details");
    }
  } else {
    logger.warn("⚠️ Web Push VAPID keys not configured; push notifications disabled.");
  }
}

export function isPushAvailable(): boolean {
  if (!isVapidConfigured) {
    initializeWebPush();
  }
  return isVapidConfigured;
}

// Auto-initialize on import if env is present
initializeWebPush();

export { webpush };
