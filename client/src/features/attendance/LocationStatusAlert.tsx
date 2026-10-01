import type React from "react";
import { Button, Spinner } from "../../components/ui.js";
import type { LocationSource } from "../../hooks/useGeolocation.js";

interface LocationStatusAlertProps {
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  locationSource?: LocationSource | string;
  ipAddress?: string | null;
  ipFallbackActive?: boolean;
  canUseFallback?: boolean;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  onUseFallback?: () => void;
}

export function LocationStatusAlert({
  latitude,
  longitude,
  accuracy,
  locationSource = "GPS_EXACT",
  ipAddress,
  ipFallbackActive,
  canUseFallback,
  loading,
  error,
  onRetry,
  onUseFallback,
}: LocationStatusAlertProps): React.ReactElement | null {
  const hasValidLocation = Boolean(
    latitude !== null && longitude !== null && (latitude !== 0 || longitude !== 0),
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 8,
          fontSize: 13,
          color: "#0369a1",
          marginBottom: 12,
        }}
      >
        <Spinner label="Acquiring GPS location" />
        <span>Detecting GPS location (high-accuracy satellite &amp; network fix)…</span>
      </div>
    );
  }

  // Priority 2 IP Fallback Active
  if (hasValidLocation && (locationSource === "IP_FALLBACK" || ipFallbackActive)) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          padding: "8px 14px",
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 8,
          fontSize: 12,
          color: "#92400e",
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <span>
            🌐 <strong>IP Fallback Active:</strong> Coordinates inferred from network IP{" "}
            {ipAddress ? `(${ipAddress})` : ""}
            {accuracy ? ` (±${Math.round(accuracy > 1000 ? accuracy / 1000 : accuracy)}${accuracy > 1000 ? "km" : "m"})` : ""}.
          </span>
          <span style={{ display: "block", fontSize: 11, color: "#b45309", marginTop: 2 }}>
            Record will be submitted for Incharge / Super Incharge approval.
          </span>
        </div>
        {onRetry && (
          <Button
            type="button"
            variant="ghost"
            style={{
              padding: "4px 10px",
              fontSize: 12,
              background: "#fff",
              border: "1px solid #f59e0b",
              color: "#b45309",
              fontWeight: 600,
            }}
            onClick={onRetry}
          >
            🔄 Retry GPS
          </Button>
        )}
      </div>
    );
  }

  // GPS failed — show error + Retry GPS + optional "Use IP Fallback" button
  if (!hasValidLocation && (error || canUseFallback)) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "10px 14px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 8,
          fontSize: 13,
          color: "#991b1b",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <strong>⚠️ GPS Location Not Acquired</strong>
            {error && <span style={{ display: "block", fontSize: 12, marginTop: 2 }}>{error}</span>}
          </div>
          {onRetry && (
            <Button
              type="button"
              variant="ghost"
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background: "#fff",
                border: "1px solid #fca5a5",
                color: "#991b1b",
                fontWeight: 600,
              }}
              onClick={onRetry}
            >
              🔄 Retry GPS
            </Button>
          )}
        </div>
        {canUseFallback && onUseFallback && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 6,
            }}
          >
            <div style={{ flex: 1, fontSize: 12, color: "#92400e" }}>
              <strong>Can't get GPS?</strong> Use IP-based location instead. This record will require Incharge/Super Incharge approval.
            </div>
            <Button
              type="button"
              variant="ghost"
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 700,
                background: "#d97706",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                whiteSpace: "nowrap",
              }}
              onClick={onUseFallback}
            >
              🌐 Use IP Fallback
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Priority 1 GPS Success (Exact or Network or Cache)
  if (hasValidLocation && latitude !== null && longitude !== null) {
    const isExact = locationSource === "GPS_EXACT";
    const label = isExact
      ? "GPS Verified"
      : locationSource === "CACHED_GPS"
        ? "Cached GPS Fix"
        : "Network/Wi-Fi Fix";

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          background: isExact ? "#f0fdf4" : "#fefce8",
          border: isExact ? "1px solid #bbf7d0" : "1px solid #fef08a",
          borderRadius: 8,
          fontSize: 12,
          color: isExact ? "#166534" : "#854d0e",
          marginBottom: 12,
        }}
      >
        <span>
          {isExact ? "📍" : "📶"} <strong>{label}:</strong> {latitude.toFixed(6)}, {longitude.toFixed(6)}
          {accuracy ? ` (±${Math.round(accuracy)}m)` : ""}
        </span>
        {onRetry && (
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: isExact ? "#15803d" : "#a16207",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={onRetry}
          >
            Refresh
          </button>
        )}
      </div>
    );
  }

  return null;
}
