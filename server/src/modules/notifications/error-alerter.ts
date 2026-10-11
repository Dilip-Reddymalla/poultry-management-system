import { logger } from "../../config/logger.js";
import { createAndSendNotification } from "./notification.service.js";

// In-memory deduplication cache: errorKey -> lastSentTimestamp
const errorDedupCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes sliding window

export async function notifySystemAdmin500Error(params: {
  path: string;
  method: string;
  errorName: string;
  errorMessage: string;
  requestId?: string | undefined;
  userId?: string | undefined;
  systemErrorId?: string | undefined;
}): Promise<void> {
  const { path, method, errorName, errorMessage, requestId, systemErrorId } = params;

  // Deduplicate errors to prevent spamming during high-frequency loop crashes
  const dedupKey = `${method}:${path}:${errorName}:${errorMessage.substring(0, 100)}`;
  const now = Date.now();
  const lastSent = errorDedupCache.get(dedupKey);

  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
    logger.debug({ dedupKey }, "Suppressed duplicate 500 error push notification");
    return;
  }

  errorDedupCache.set(dedupKey, now);

  // Clean stale keys periodically
  if (errorDedupCache.size > 200) {
    for (const [key, timestamp] of errorDedupCache.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        errorDedupCache.delete(key);
      }
    }
  }

  const title = `🚨 Server 500: [${method}] ${path}`;
  const shortMsg = errorMessage.length > 120 ? `${errorMessage.substring(0, 117)}...` : errorMessage;
  const body = `Reason: ${errorName} - ${shortMsg} ${requestId ? `(Req: #${requestId})` : ""}`;
  const linkUrl = systemErrorId
    ? `/audit-logs?tab=system-errors&errorId=${encodeURIComponent(systemErrorId)}`
    : `/audit-logs?tab=system-errors${requestId ? `&search=${encodeURIComponent(requestId)}` : ""}`;

  try {
    await createAndSendNotification({
      isSystemAdmin: true,
      category: "SERVER_500_ERROR",
      priority: "CRITICAL",
      title,
      body,
      linkUrl,
      tag: `error-500-${Date.now()}`,
      metadata: {
        path,
        method,
        errorName,
        errorMessage,
        requestId,
        userId: params.userId,
        systemErrorId,
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to dispatch 500 alert to System Admin");
  }
}
