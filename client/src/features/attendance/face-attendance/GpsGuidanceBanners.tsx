import type React from "react";
import { styles } from "./face-attendance.styles.js";

interface GpsGuidanceBannersProps {
  deviceLocationOff: boolean;
  locationPermissionDenied: boolean;
  gpsTimedOut: boolean;
  hasValidLocation: boolean;
  isIOS: boolean;
  isGpsLoading: boolean;
  onRequestGpsLocation: () => void;
}

export function GpsGuidanceBanners({
  deviceLocationOff,
  locationPermissionDenied,
  gpsTimedOut,
  hasValidLocation,
  isIOS,
  isGpsLoading,
  onRequestGpsLocation,
}: GpsGuidanceBannersProps): React.ReactElement | null {
  if (hasValidLocation) return null;

  return (
    <>
      {/* 1. Phone Location / GPS Turned Off Guidance Banner */}
      {deviceLocationOff && (
        <div
          style={{
            ...styles.card,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            padding: "16px 20px",
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 28, lineHeight: 1 }}>📱</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "#92400e", fontSize: 15, display: "block", marginBottom: 6 }}>
              {isIOS ? "⛔ iPhone Location Services are Turned OFF" : "⛔ Phone Location (GPS) is Turned Off"} — Attendance Blocked
            </strong>
            {isIOS ? (
              <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6 }}>
                Location Services are disabled on this iPhone or for Safari. Attendance cannot be recorded without verified GPS coordinates.
                <br />
                <strong>How to turn ON on iPhone:</strong>
                <ol style={{ margin: "6px 0 8px 18px", padding: 0 }}>
                  <li>Open iPhone <strong>Settings</strong> &rarr; tap <strong>Privacy &amp; Security</strong> &rarr; <strong>Location Services</strong>.</li>
                  <li>Toggle <strong>Location Services</strong> to <strong>ON</strong>.</li>
                  <li>Scroll down to <strong>Safari Websites</strong> (or <strong>Poultry Manager</strong> if opened from Home Screen).</li>
                  <li>Set to <strong>While Using the App</strong> and make sure <strong>Precise Location</strong> is turned <strong>ON</strong>.</li>
                  <li>Return here and tap <strong>Retry GPS</strong> below.</li>
                </ol>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6 }}>
                Your device&apos;s master <strong>Location / GPS switch</strong> is turned OFF in phone settings. Attendance cannot be recorded without GPS.
                <br />
                <strong>How to turn ON on Android:</strong>
                <ol style={{ margin: "6px 0 8px 18px", padding: 0 }}>
                  <li>Swipe down from the top of your phone screen to open the Quick Settings panel.</li>
                  <li>Tap the <strong>Location / GPS</strong> toggle to turn it <strong>ON</strong> (enable Google Location Accuracy if prompted).</li>
                  <li>Tap <strong>Retry GPS</strong> below.</li>
                </ol>
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  background: "#d97706",
                  color: "#fff",
                  cursor: isGpsLoading ? "not-allowed" : "pointer",
                }}
                disabled={isGpsLoading}
                onClick={onRequestGpsLocation}
              >
                {isGpsLoading ? "📡 Detecting…" : "🔄 Turn ON & Retry GPS"}
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                ⛔ Attendance is strictly BLOCKED until GPS location is acquired.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Location Permission Denied Guidance Banner */}
      {locationPermissionDenied && (
        <div
          style={{
            ...styles.card,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "16px 20px",
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 28, lineHeight: 1 }}>🚫</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "#991b1b", fontSize: 15, display: "block", marginBottom: 6 }}>
              ⛔ Location Permission Blocked — Attendance Blocked
            </strong>
            {isIOS ? (
              <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.6 }}>
                Safari or iOS blocked location access for this application.
                <br />
                <strong>How to unblock on iPhone:</strong>
                <ol style={{ margin: "6px 0 8px 18px", padding: 0 }}>
                  <li>Tap the <strong>&quot;aA&quot;</strong> icon on the left side of the Safari search/address bar.</li>
                  <li>Tap <strong>Website Settings</strong> &rarr; find <strong>Location</strong> and select <strong>Allow</strong>.</li>
                  <li>If prompted, tap <strong>Allow While Using App</strong>.</li>
                  <li>Tap <strong>Retry GPS</strong> below.</li>
                </ol>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.6 }}>
                Location permission was denied in your browser settings.
                <br />
                <strong>How to unblock on Android / Chrome:</strong>
                <ol style={{ margin: "6px 0 8px 18px", padding: 0 }}>
                  <li>Tap the lock or page settings icon (🔒 or ⚙️) beside the website address in Chrome.</li>
                  <li>Tap <strong>Permissions</strong> &rarr; toggle <strong>Location</strong> to <strong>Allow</strong>.</li>
                  <li>Tap <strong>Retry GPS</strong> below.</li>
                </ol>
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  cursor: isGpsLoading ? "not-allowed" : "pointer",
                }}
                disabled={isGpsLoading}
                onClick={onRequestGpsLocation}
              >
                {isGpsLoading ? "📡 Detecting…" : "🔄 Unblock & Retry GPS"}
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                ⛔ Attendance is strictly BLOCKED until GPS location is acquired.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. GPS Signal Timeout / Weak Signal Guidance Banner */}
      {gpsTimedOut && (
        <div
          style={{
            ...styles.card,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            padding: "16px 20px",
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 28, lineHeight: 1 }}>📡</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "#1e40af", fontSize: 15, display: "block", marginBottom: 6 }}>
              📡 GPS Signal Timeout (Weak Signal) — Location Not Acquired
            </strong>
            <div style={{ fontSize: 13, color: "#1e3a8a", lineHeight: 1.6 }}>
              Your device location is turned ON and permissions are allowed, but your phone could not get a satellite or network fix in time. This commonly occurs indoors, under metal farm sheds, or in remote areas.
              <br />
              <strong>Tips to acquire a quick fix:</strong>
              <ul style={{ margin: "6px 0 8px 18px", padding: 0 }}>
                <li>Step closer to an open doorway, window, or step outside for 5–10 seconds.</li>
                <li>Connecting to farm Wi-Fi or turning Wi-Fi ON helps phones triangulate location instantly.</li>
                <li>Tap <strong>Retry GPS</strong> below.</li>
              </ul>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: isGpsLoading ? "not-allowed" : "pointer",
                }}
                disabled={isGpsLoading}
                onClick={onRequestGpsLocation}
              >
                {isGpsLoading ? "📡 Detecting…" : "🔄 Retry GPS Acquisition"}
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
                Keep screen open while acquiring satellite fix.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
