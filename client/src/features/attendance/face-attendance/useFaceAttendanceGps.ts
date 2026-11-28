import { useMemo } from "react";
import type { GpsLocationState } from "./face-attendance.types.js";
import { useGeolocation, type LocationSource } from "../../../hooks/useGeolocation.js";

/**
 * Face-attendance GPS state, built on the shared `useGeolocation` hook so the
 * tier-1/2/3 GPS acquisition logic lives in exactly one place
 * (src/hooks/useGeolocation.ts). This wrapper only maps that shared state into
 * the UI-facing `GpsLocationState` shape used by the FaceAttendancePage.
 */

function describeLocation(state: {
  loading: boolean;
  location: string | null;
  locationSource: LocationSource;
  accuracy: number | null;
  ipAddress: string | null;
  city: string | null;
  ipFallbackActive: boolean;
  error: string | null;
  gpsTimedOut: boolean;
}): string {
  if (state.ipFallbackActive) {
    return `🌐 IP Fallback Active (${state.city || "Network"}, IP: ${state.ipAddress || "unknown"}) — Attendance allowed with Incharge approval`;
  }

  if (state.error) {
    if (state.gpsTimedOut) {
      return `⚠️ GPS satellite signal timeout. Tap "Retry GPS" or use IP Fallback below.`;
    }
    return `⚠️ ${state.error}. Tap "Retry GPS" or use IP Fallback below.`;
  }

  if (state.loading) {
    return "Detecting GPS location…";
  }

  if (state.location) {
    const [lat, lng] = state.location.split(",");
    const label =
      state.locationSource === "CACHED_GPS"
        ? "Cached Fix"
        : state.locationSource === "NETWORK_APPROX"
          ? "Network/Wi-Fi"
          : "Satellite GPS";
    const acc = state.accuracy !== null ? ` (±${Math.round(state.accuracy)}m)` : "";
    return `📍 ${label}: ${lat}, ${lng}${acc}`;
  }

  return "Location unavailable.";
}

export function useFaceAttendanceGps(): GpsLocationState {
  const geo = useGeolocation();

  const location =
    geo.latitude !== null && geo.longitude !== null
      ? { latitude: geo.latitude, longitude: geo.longitude }
      : null;

  const hasValidLocation = Boolean(
    location && (location.latitude !== 0 || location.longitude !== 0),
  );

  const locationStatus = useMemo(
    () =>
      describeLocation({
        loading: geo.loading,
        location: geo.location,
        locationSource: geo.locationSource,
        accuracy: geo.accuracy,
        ipAddress: geo.ipAddress,
        city: geo.city,
        ipFallbackActive: geo.ipFallbackActive,
        error: geo.error,
        gpsTimedOut: geo.gpsTimedOut,
      }),
    [
      geo.loading,
      geo.location,
      geo.locationSource,
      geo.accuracy,
      geo.ipAddress,
      geo.city,
      geo.ipFallbackActive,
      geo.error,
      geo.gpsTimedOut,
    ],
  );

  return {
    location,
    locationStatus,
    hasValidLocation,
    deviceLocationOff: geo.deviceLocationOff,
    locationPermissionDenied: geo.permissionDenied,
    gpsTimedOut: geo.gpsTimedOut,
    isGpsLoading: geo.loading,
    isIOS: geo.isIOS,
    locationSource: geo.locationSource,
    accuracy: geo.accuracy,
    ipAddress: geo.ipAddress,
    ipFallbackActive: geo.ipFallbackActive,
    canUseFallback: geo.canUseFallback,
    requestGpsLocation: geo.retry,
    useFallbackLocation: geo.useFallbackLocation,
  };
}
