import { OfflineIcon } from "../components/icons.js";
import { useOnlineStatus } from "./useOnlineStatus.js";

/**
 * A single quiet line, shown only while the device reports no network. The shell
 * is cached so the app still opens offline; business data is not, so this says
 * plainly that nothing on screen will refresh and nothing can be saved.
 */
export function OfflineNotice(): React.ReactElement | null {
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <div className="offline-notice" role="status">
      <OfflineIcon className="offline-notice__icon" />
      <span>
        No connection. Records will not load or refresh, and changes cannot be
        saved until the network returns.
      </span>
    </div>
  );
}
