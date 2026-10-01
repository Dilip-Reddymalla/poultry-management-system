import { useCallback, useEffect, useRef, useState } from "react";
import type { GpsLocationState } from "./face-attendance.types.js";
import { fetchCurrentLocation } from "../../../api/resources.js";
import type { LocationSource } from "../../../hooks/useGeolocation.js";

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
  const [locationStatus, setLocationStatus] = useState<string>("Detecting GPS location…");
  const [deviceLocationOff, setDeviceLocationOff] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [locationSource, setLocationSource] = useState<LocationSource>("GPS_EXACT");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [ipFallbackActive, setIpFallbackActive] = useState(false);
  const [canUseFallback, setCanUseFallback] = useState(false);

  const activeAttemptRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const hasValidLocation = Boolean(location && (location.latitude !== 0 || location.longitude !== 0));

  // User-triggered IP fallback — only called from explicit button click
  const useFallbackLocation = useCallback(async () => {
    setLocationStatus("🌐 Connecting to IP Geolocation fallback…");
    setIsGpsLoading(true);
    try {
      const ipLocation = await fetchCurrentLocation();
      setLocation({
        latitude: ipLocation.latitude,
        longitude: ipLocation.longitude,
      });
      setLocationSource("IP_FALLBACK");
      setAccuracy(ipLocation.accuracy);
      setIpAddress(ipLocation.ip);
      setIpFallbackActive(true);
      setCanUseFallback(false);
      setIsGpsLoading(false);
      setLocationStatus(
        `🌐 IP Fallback Active (${ipLocation.city || "Network"}, IP: ${ipLocation.ip}) — Attendance allowed with Incharge approval`,
      );
    } catch {
      setIsGpsLoading(false);
      setIpFallbackActive(false);
      setLocationStatus(
        "⛔ Location Acquisition Failed: Neither GPS nor Network IP could be resolved. Please check internet connection.",
      );
    }
  }, []);

  const onGpsSuccess = useCallback(
    (pos: GeolocationPosition, source: LocationSource = "GPS_EXACT") => {
      clearWatch();
      setIsGpsLoading(false);
      setDeviceLocationOff(false);
      setLocationPermissionDenied(false);
      setGpsTimedOut(false);
      setIpFallbackActive(false);
      setCanUseFallback(false);
      setLocationSource(source);
      setAccuracy(pos.coords.accuracy);
      setIpAddress(null);
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      const label =
        source === "CACHED_GPS"
          ? "Cached Fix"
          : source === "NETWORK_APPROX"
            ? "Network/Wi-Fi"
            : "Satellite GPS";

      setLocationStatus(
        `📍 ${label}: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)} (±${Math.round(pos.coords.accuracy)}m)`,
      );

      // Keep live coordinates updated in background
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (livePos) => {
            setLocation({
              latitude: livePos.coords.latitude,
              longitude: livePos.coords.longitude,
            });
            setAccuracy(livePos.coords.accuracy);
            setLocationSource("GPS_EXACT");
            setIpFallbackActive(false);
            setCanUseFallback(false);
          },
          () => {},
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 },
        );
      }
    },
    [clearWatch],
  );

  // When GPS fails, set diagnostic state but do NOT auto-trigger IP fallback.
  // Set canUseFallback = true so the UI shows a fallback button.
  const handleGpsFailure = useCallback(
    async (err: GeolocationPositionError, isTimeout: boolean) => {
      let permissionState: PermissionState | null = null;
      try {
        if ("permissions" in navigator && navigator.permissions?.query) {
          const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          permissionState = perm.state;
        }
      } catch {
        // Permissions API not supported or throws on iOS Safari
      }

      let isPermissionDenied = false;
      let isDeviceOff = false;
      let isTimedOut = false;
      let reason = "Unable to acquire GPS location";

      if (err.code === err.PERMISSION_DENIED || permissionState === "denied") {
        isPermissionDenied = true;
        reason = "Location permission blocked";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        isDeviceOff = true;
        reason = isIOS ? "iOS Location Services OFF" : "Phone GPS OFF";
      } else if (isTimeout || err.code === err.TIMEOUT) {
        isTimedOut = true;
        reason = "GPS satellite signal timeout";
      }

      // Do NOT auto-fallback — set canUseFallback for opt-in
      setIsGpsLoading(false);
      setLocationPermissionDenied(isPermissionDenied);
      setDeviceLocationOff(isDeviceOff);
      setGpsTimedOut(isTimedOut);
      setCanUseFallback(true);
      setIpFallbackActive(false);
      setLocationStatus(`⚠️ ${reason}. Tap "Retry GPS" or use IP Fallback below.`);
    },
    [isIOS],
  );

  const requestGpsLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setIsGpsLoading(false);
      setCanUseFallback(true);
      setLocationStatus("Geolocation not supported by browser. Use IP Fallback.");
      return;
    }

    clearWatch();
    const attemptId = Date.now();
    activeAttemptRef.current = attemptId;

    setIsGpsLoading(true);
    setCanUseFallback(false);
    setLocationStatus("📡 Detecting high-accuracy GPS location (Attempt 1/3)…");

    // Tier 1: High accuracy satellite GPS (6s timeout, fresh coordinates)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (activeAttemptRef.current === attemptId) {
          onGpsSuccess(pos, "GPS_EXACT");
        }
      },
      (firstErr) => {
        if (activeAttemptRef.current !== attemptId) return;

        // If user explicitly denied permission, show failure with fallback option
        if (firstErr.code === firstErr.PERMISSION_DENIED) {
          void handleGpsFailure(firstErr, false);
          return;
        }

        // Tier 2: Network / Wi-Fi / Cell tower location (5s timeout, fresh)
        setLocationStatus("📡 GPS weak/slow, trying network & Wi-Fi location (Attempt 2/3)…");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (activeAttemptRef.current === attemptId) {
              onGpsSuccess(pos, "NETWORK_APPROX");
            }
          },
          (secondErr) => {
            if (activeAttemptRef.current !== attemptId) return;

            if (secondErr.code === secondErr.PERMISSION_DENIED) {
              void handleGpsFailure(secondErr, false);
              return;
            }

            // Tier 3: Cached position within last 15 mins (3s timeout)
            setLocationStatus("📡 Network location unavailable, checking cached position (Attempt 3/3)…");
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (activeAttemptRef.current === attemptId) {
                  onGpsSuccess(pos, "CACHED_GPS");
                }
              },
              (thirdErr) => {
                if (activeAttemptRef.current !== attemptId) return;
                const finalErr = thirdErr || secondErr || firstErr;
                const wasTimeout =
                  firstErr.code === firstErr.TIMEOUT &&
                  secondErr.code === secondErr.TIMEOUT &&
                  (!thirdErr || thirdErr.code === thirdErr.TIMEOUT);
                void handleGpsFailure(finalErr, wasTimeout);
              },
              { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 3000 },
            );
          },
          { enableHighAccuracy: false, maximumAge: 0, timeout: 5000 },
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 },
    );
  }, [clearWatch, onGpsSuccess, handleGpsFailure]);

  useEffect(() => {
    requestGpsLocation();
    return () => {
      clearWatch();
    };
  }, [requestGpsLocation, clearWatch]);

  return {
    location,
    locationStatus,
    hasValidLocation,
    deviceLocationOff,
    locationPermissionDenied,
    gpsTimedOut,
    isGpsLoading,
    isIOS,
    locationSource,
    accuracy,
    ipAddress,
    ipFallbackActive,
    canUseFallback,
    requestGpsLocation,
    useFallbackLocation,
  };
}
