
export interface FaceSelection {
  faceIndex: number;
  personId: string | null;
  personType: "EMPLOYEE" | "WORKER" | null;
}

export interface FaceAiHealthState {
  online: boolean;
  circuitBreakerState?: "CLOSED" | "OPEN" | "HALF_OPEN";
  message?: string;
  fallbackMode?: "MANUAL_ATTENDANCE" | null;
}

export interface GpsLocationState {
  location: { latitude: number; longitude: number } | null;
  locationStatus: string;
  hasValidLocation: boolean;
  deviceLocationOff: boolean;
  locationPermissionDenied: boolean;
  gpsTimedOut: boolean;
  isGpsLoading: boolean;
  isIOS: boolean;
  locationSource: "GPS_EXACT" | "NETWORK_APPROX" | "CACHED_GPS" | "IP_FALLBACK" | "FARM_DEFAULT";
  accuracy: number | null;
  ipAddress: string | null;
  ipFallbackActive: boolean;
  canUseFallback: boolean;
  requestGpsLocation: () => void;
  useFallbackLocation: () => Promise<void>;
}
