import type React from "react";
import { Button, Spinner } from "../../components/ui.js";

interface LocationStatusAlertProps {
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export function LocationStatusAlert({
  latitude,
  longitude,
  accuracy,
  loading,
  error,
  onRetry,
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
        <span>Detecting GPS location (high-accuracy with network fallback)…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="alert alert--danger"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <strong>⛔ Location Required:</strong> {error}
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
    );
  }

  if (hasValidLocation && latitude !== null && longitude !== null) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          fontSize: 12,
          color: "#166534",
          marginBottom: 12,
        }}
      >
        <span>
          📍 <strong>GPS Verified:</strong> {latitude.toFixed(6)}, {longitude.toFixed(6)}
          {accuracy ? ` (±${Math.round(accuracy)}m)` : ""}
        </span>
        {onRetry && (
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: "#15803d",
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
