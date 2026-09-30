import { useCallback, useEffect, useState } from "react";
import type { GpsLocationState } from "./face-attendance.types.js";

const isIOSDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

export function useFaceAttendanceGps(): GpsLocationState {
  const isIOS = isIOSDevice();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>("Fetching GPS location…");
  const [deviceLocationOff, setDeviceLocationOff] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  const hasValidLocation = Boolean(location && (location.latitude !== 0 || location.longitude !== 0));

  const requestGpsLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("📍 Geolocation not supported by browser");
      return;
    }

    setIsGpsLoading(true);
    setLocationStatus("📡 Detecting high-accuracy GPS location (Attempt 1/3)…");

    const onGpsSuccess = (pos: GeolocationPosition) => {
      setIsGpsLoading(false);
      setDeviceLocationOff(false);
      setLocationPermissionDenied(false);
      setGpsTimedOut(false);
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setLocationStatus(
        `📍 GPS Fixed: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)} (±${Math.round(pos.coords.accuracy)}m)`,
      );
    };

    const handleGpsFailure = async (err: GeolocationPositionError, isTimeout: boolean) => {
      let permissionState: PermissionState | null = null;
      try {
        if ("permissions" in navigator && navigator.permissions?.query) {
          const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          permissionState = perm.state;
        }
      } catch {
        // Permissions API not supported or throws on iOS Safari
      }

      setIsGpsLoading(false);
      setLocation(null);

      if (err.code === err.PERMISSION_DENIED || permissionState === "denied") {
        setLocationPermissionDenied(true);
        setDeviceLocationOff(false);
        setGpsTimedOut(false);
        setLocationStatus("⛔ Location Permission Denied: Permission blocked in browser or OS. Attendance is strictly BLOCKED.");
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setDeviceLocationOff(true);
        setLocationPermissionDenied(false);
        setGpsTimedOut(false);
        setLocationStatus(
          isIOS
            ? "⛔ Location Disabled: iOS Location Services is OFF. Attendance is strictly BLOCKED."
            : "⛔ GPS OFF: Phone Location switch is OFF. Attendance is strictly BLOCKED."
        );
      } else if (isTimeout || err.code === err.TIMEOUT) {
        // All attempts timed out, but permission was not denied
        setGpsTimedOut(true);
        setDeviceLocationOff(false);
        setLocationPermissionDenied(false);
        setLocationStatus("⛔ GPS Signal Timeout: Weak satellite/network fix. Move to an open area and retry.");
      } else {
        setDeviceLocationOff(false);
        setLocationPermissionDenied(false);
        setGpsTimedOut(false);
        setLocationStatus(`⛔ GPS Error: ${err.message || "Unable to acquire location"}. Attendance is strictly BLOCKED.`);
      }
    };

    // Attempt 1: High accuracy GPS (8s timeout, fresh coordinates)
    navigator.geolocation.getCurrentPosition(
      onGpsSuccess,
      (firstErr) => {
        // If user explicitly denied permission, stop immediately
        if (firstErr.code === firstErr.PERMISSION_DENIED) {
          void handleGpsFailure(firstErr, false);
          return;
        }

        // Attempt 2: Network / Wi-Fi / Cell tower location (6s timeout, fresh)
        setLocationStatus("📡 GPS weak/slow, trying network & Wi-Fi location (Attempt 2/3)…");
        navigator.geolocation.getCurrentPosition(
          onGpsSuccess,
          (secondErr) => {
            if (secondErr.code === secondErr.PERMISSION_DENIED) {
              void handleGpsFailure(secondErr, false);
              return;
            }

            // Attempt 3: Cached position within last 60s (4s timeout)
            setLocationStatus("📡 Network location unavailable, checking recent cached position (Attempt 3/3)…");
            navigator.geolocation.getCurrentPosition(
              onGpsSuccess,
              (thirdErr) => {
                const finalErr = thirdErr || secondErr || firstErr;
                const wasTimeout =
                  firstErr.code === firstErr.TIMEOUT &&
                  secondErr.code === secondErr.TIMEOUT &&
                  (!thirdErr || thirdErr.code === thirdErr.TIMEOUT);
                void handleGpsFailure(finalErr, wasTimeout);
              },
              { enableHighAccuracy: false, maximumAge: 60000, timeout: 4000 },
            );
          },
          { enableHighAccuracy: false, maximumAge: 0, timeout: 6000 },
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
    );
  }, [isIOS]);

  useEffect(() => {
    requestGpsLocation();
  }, [requestGpsLocation]);

  return {
    location,
    locationStatus,
    hasValidLocation,
    deviceLocationOff,
    locationPermissionDenied,
    gpsTimedOut,
    isGpsLoading,
    isIOS,
    requestGpsLocation,
  };
}
