import { useState, useEffect, useCallback, useRef } from "react";

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  location: string | null;
  deviceLocationOff: boolean;
  permissionDenied: boolean;
  gpsTimedOut: boolean;
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
    error: null,
    loading: true,
    location: null,
    deviceLocationOff: false,
    permissionDenied: false,
    gpsTimedOut: false,
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
    (pos: GeolocationPosition) => {
      clearWatch();

      setState({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        error: null,
        loading: false,
        location: `${pos.coords.latitude},${pos.coords.longitude}`,
        deviceLocationOff: false,
        permissionDenied: false,
        gpsTimedOut: false,
      });

      // Keep coordinates updated in background with relaxed watch settings
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (livePos) => {
            setState((prev) => ({
              ...prev,
              latitude: livePos.coords.latitude,
              longitude: livePos.coords.longitude,
              accuracy: livePos.coords.accuracy,
              location: `${livePos.coords.latitude},${livePos.coords.longitude}`,
            }));
          },
          () => {
            // Ignore minor watch failures once fix was already established
          },
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 },
        );
      }
    },
    [clearWatch],
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
          ? "Location access denied. In Safari, tap 'aA' in the search bar -> Website Settings -> Location -> Allow."
          : "Location access denied. Please allow location access in your browser to record attendance.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        isDeviceOff = true;
        errorMessage = isIOS
          ? "iPhone Location Services are OFF. Open Settings -> Privacy & Security -> Location Services -> Turn ON."
          : "Device Location / GPS is OFF. Please turn ON Location in your phone's quick settings.";
      } else if (isTimeout || err.code === err.TIMEOUT) {
        isGpsTimedOut = true;
        errorMessage =
          "GPS signal timeout. Weak satellite/network signal. Move closer to a window or outdoors and tap Retry.";
      } else {
        errorMessage = err.message || "Unable to acquire location.";
      }

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
        deviceLocationOff: isDeviceOff,
        permissionDenied: isPermissionDenied,
        gpsTimedOut: isGpsTimedOut,
      }));
    },
    [isIOS],
  );

  // 3-tier progressive acquisition
  const fetchPosition = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState((prev) => ({
        ...prev,
        error: "Geolocation is not supported by your browser.",
        loading: false,
        location: "",
      }));
      return;
    }

    clearWatch();
    const attemptId = Date.now();
    activeAttemptRef.current = attemptId;

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    // Tier 1: High accuracy GPS (8s timeout, fresh)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (activeAttemptRef.current === attemptId) {
          handleSuccess(pos);
        }
      },
      (firstErr) => {
        if (activeAttemptRef.current !== attemptId) return;

        // If user denied permission, stop immediately
        if (firstErr.code === firstErr.PERMISSION_DENIED) {
          void handleFailure(firstErr, false);
          return;
        }

        // Tier 2: Network / Wi-Fi / Cell tower location (6s timeout, fresh)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (activeAttemptRef.current === attemptId) {
              handleSuccess(pos);
            }
          },
          (secondErr) => {
            if (activeAttemptRef.current !== attemptId) return;

            if (secondErr.code === secondErr.PERMISSION_DENIED) {
              void handleFailure(secondErr, false);
              return;
            }

            // Tier 3: Recent cached position within 60s (4s timeout)
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (activeAttemptRef.current === attemptId) {
                  handleSuccess(pos);
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
              { enableHighAccuracy: false, maximumAge: 60000, timeout: 4000 },
            );
          },
          { enableHighAccuracy: false, maximumAge: 0, timeout: 6000 },
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
    );
  }, [clearWatch, handleSuccess, handleFailure]);

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
