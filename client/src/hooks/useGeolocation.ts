import { useState, useEffect, useCallback, useRef } from "react";
import { fetchCurrentLocation } from "../api/resources.js";

export type LocationSource =
  | "GPS_EXACT"
  | "NETWORK_APPROX"
  | "CACHED_GPS"
  | "IP_FALLBACK"
  | "FARM_DEFAULT";

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationSource: LocationSource;
  ipAddress: string | null;
  city: string | null;
  error: string | null;
  loading: boolean;
  location: string | null;
  deviceLocationOff: boolean;
  permissionDenied: boolean;
  gpsTimedOut: boolean;
  ipFallbackActive: boolean;
  isIOS: boolean;
  retry: () => void;
}

const isIOSDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

export function useGeolocation(): GeolocationState {
  const isIOS = isIOSDevice();
  const [state, setState] = useState<Omit<GeolocationState, "retry" | "isIOS">>({
    latitude: null,
    longitude: null,
    accuracy: null,
    locationSource: "GPS_EXACT",
    ipAddress: null,
    city: null,
    error: null,
    loading: true,
    location: null,
    deviceLocationOff: false,
    permissionDenied: false,
    gpsTimedOut: false,
    ipFallbackActive: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const activeAttemptRef = useRef<number>(0);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const handleSuccess = useCallback(
    (pos: GeolocationPosition, source: LocationSource = "GPS_EXACT") => {
      clearWatch();

      setState({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        locationSource: source,
        ipAddress: null,
        city: null,
        error: null,
        loading: false,
        location: `${pos.coords.latitude},${pos.coords.longitude}`,
        deviceLocationOff: false,
        permissionDenied: false,
        gpsTimedOut: false,
        ipFallbackActive: false,
      });

      // Keep coordinates fresh with background watchPosition
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (livePos) => {
            setState((prev) => ({
              ...prev,
              latitude: livePos.coords.latitude,
              longitude: livePos.coords.longitude,
              accuracy: livePos.coords.accuracy,
              locationSource: "GPS_EXACT",
              ipFallbackActive: false,
              location: `${livePos.coords.latitude},${livePos.coords.longitude}`,
            }));
          },
          () => {
            // Ignore minor watch failures once fix was established
          },
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 },
        );
      }
    },
    [clearWatch],
  );

  // Fallback to IP Geolocation when native Geolocation fails
  const triggerIpFallback = useCallback(
    async (
      failureReason: string,
      isPermissionDenied: boolean,
      isDeviceOff: boolean,
      isGpsTimedOut: boolean,
    ) => {
      try {
        const ipLocation = await fetchCurrentLocation();
        setState((prev) => ({
          ...prev,
          latitude: ipLocation.latitude,
          longitude: ipLocation.longitude,
          accuracy: ipLocation.accuracy,
          locationSource: "IP_FALLBACK",
          ipAddress: ipLocation.ip,
          city: ipLocation.city,
          location: `${ipLocation.latitude},${ipLocation.longitude}`,
          loading: false,
          error: null,
          deviceLocationOff: isDeviceOff,
          permissionDenied: isPermissionDenied,
          gpsTimedOut: isGpsTimedOut,
          ipFallbackActive: true,
        }));
      } catch {
        // If IP lookup also failed (completely offline), show the failure message
        setState((prev) => ({
          ...prev,
          error: failureReason,
          loading: false,
          deviceLocationOff: isDeviceOff,
          permissionDenied: isPermissionDenied,
          gpsTimedOut: isGpsTimedOut,
          ipFallbackActive: false,
        }));
      }
    },
    [],
  );

  const handleFailure = useCallback(
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

      let errorMessage = "Unable to retrieve GPS location.";
      let isPermissionDenied = false;
      let isDeviceOff = false;
      let isGpsTimedOut = false;

      if (err.code === err.PERMISSION_DENIED || permissionState === "denied") {
        isPermissionDenied = true;
        errorMessage = isIOS
          ? "Location access denied. In Safari, tap 'aA' in search bar -> Website Settings -> Location -> Allow."
          : "Location access denied. Please allow location access in your browser.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        isDeviceOff = true;
        errorMessage = isIOS
          ? "iPhone Location Services are OFF. Turn ON in Settings -> Privacy & Security."
          : "Device Location / GPS is OFF. Turn ON Location in phone quick settings.";
      } else if (isTimeout || err.code === err.TIMEOUT) {
        isGpsTimedOut = true;
        errorMessage = "GPS signal timeout. Weak satellite fix inside building.";
      } else {
        errorMessage = err.message || "Unable to acquire location.";
      }

      // Priority 2: Engage IP Fallback
      await triggerIpFallback(errorMessage, isPermissionDenied, isDeviceOff, isGpsTimedOut);
    },
    [isIOS, triggerIpFallback],
  );

  // Progressive Priority 1 acquisition: High Accuracy GPS -> Network/Wi-Fi -> Warm Cache -> Fallback
  const fetchPosition = useCallback(() => {
    if (!("geolocation" in navigator)) {
      void triggerIpFallback("Geolocation is not supported by your browser.", false, false, false);
      return;
    }

    clearWatch();
    const attemptId = Date.now();
    activeAttemptRef.current = attemptId;

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      ipFallbackActive: false,
    }));

    // Tier 1: High accuracy satellite GPS (6s timeout, fresh)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (activeAttemptRef.current === attemptId) {
          handleSuccess(pos, "GPS_EXACT");
        }
      },
      (firstErr) => {
        if (activeAttemptRef.current !== attemptId) return;

        // If user explicitly denied permission, skip straight to fallback
        if (firstErr.code === firstErr.PERMISSION_DENIED) {
          void handleFailure(firstErr, false);
          return;
        }

        // Tier 2: Network / Wi-Fi / Cell tower location (5s timeout, fresh)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (activeAttemptRef.current === attemptId) {
              handleSuccess(pos, "NETWORK_APPROX");
            }
          },
          (secondErr) => {
            if (activeAttemptRef.current !== attemptId) return;

            if (secondErr.code === secondErr.PERMISSION_DENIED) {
              void handleFailure(secondErr, false);
              return;
            }

            // Tier 3: Recent warm cached position within last 15 minutes (3s timeout)
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (activeAttemptRef.current === attemptId) {
                  handleSuccess(pos, "CACHED_GPS");
                }
              },
              (thirdErr) => {
                if (activeAttemptRef.current !== attemptId) return;
                const finalErr = thirdErr || secondErr || firstErr;
                const wasTimeout =
                  firstErr.code === firstErr.TIMEOUT &&
                  secondErr.code === secondErr.TIMEOUT &&
                  (!thirdErr || thirdErr.code === thirdErr.TIMEOUT);
                void handleFailure(finalErr, wasTimeout);
              },
              { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 3000 },
            );
          },
          { enableHighAccuracy: false, maximumAge: 0, timeout: 5000 },
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 },
    );
  }, [clearWatch, handleSuccess, handleFailure, triggerIpFallback]);

  useEffect(() => {
    fetchPosition();
    return () => {
      clearWatch();
    };
  }, [fetchPosition, clearWatch]);

  return {
    ...state,
    isIOS,
    retry: fetchPosition,
  };
}
