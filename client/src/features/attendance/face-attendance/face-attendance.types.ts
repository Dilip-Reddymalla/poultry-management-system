
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
  requestGpsLocation: () => void;
}
