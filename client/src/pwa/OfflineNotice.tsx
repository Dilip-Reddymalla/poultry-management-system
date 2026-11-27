import { useTranslation } from "react-i18next";
import { OfflineIcon } from "../components/icons.js";
import { useOfflineQueue } from "../hooks/useOfflineQueue.js";
import "./Pwa.css";

/**
 * A single quiet line about connectivity and queued work. Shown while the device
 * is offline, or while queued attendance records are waiting to sync (or are
 * mid-sync). The shell is cached so the app still opens offline; queued records
 * are replayed by `OfflineQueueProvider` when connectivity returns.
 */
export function OfflineNotice(): React.ReactElement | null {
  const { t } = useTranslation();
  const { online, pendingCount, syncing } = useOfflineQueue();

  if (online && pendingCount === 0) {
    return null;
  }

  const statusText = online
    ? syncing
      ? t("offline.syncing")
      : t("offline.pending", { count: pendingCount })
    : t("offline.notice");

  const shortLabel = online
    ? syncing
      ? "🔄"
      : `📋 ${pendingCount}`
    : pendingCount > 0
      ? `❌📶 · 📋 ${pendingCount}`
      : "❌📶";

  return (
    <div
      className="offline-notice"
      role="status"
      title={statusText}
      aria-label={statusText}
      style={{ alignItems: "center", justifyContent: "space-between", fontWeight: 600 }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <OfflineIcon className="offline-notice__icon" />
        <span>{shortLabel}</span>
      </span>
      <span className="mobile-hide-label" style={{ fontWeight: 400 }}>
        {statusText}
      </span>
    </div>
  );
}
