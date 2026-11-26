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

  return (
    <div className="offline-notice" role="status">
      <OfflineIcon className="offline-notice__icon" />
      <span>{statusText}</span>
    </div>
  );
}
