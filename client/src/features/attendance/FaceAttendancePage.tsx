import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Farm, Shed, Shift } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { apiClient } from "../../api/client.js";
import { fetchSheds } from "../../api/resources.js";
import { useAuth } from "../../auth/use-auth.js";
import {
  processFrame,
  bulkMarkFaceAttendance,
  type ProcessedFace,
  type FrameProcessResult,
  type FaceAttendanceRecord,
} from "../../api/face-attendance.api.js";

/* ------------------------------------------------------------------ */
import { validateShiftTiming, SHIFT_TIMINGS } from "../../lib/shift-timing.js";

function shiftLabel(shift: Shift): string {
  return SHIFT_TIMINGS[shift]?.label ?? shift;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = {
  page: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 20px",
  } as React.CSSProperties,

  header: {
    marginBottom: 24,
  } as React.CSSProperties,

  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text-primary, #1a1a2e)",
    marginBottom: 4,
  } as React.CSSProperties,

  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary, #6b7280)",
  } as React.CSSProperties,

  card: {
    background: "var(--surface, #fff)",
    borderRadius: 12,
    border: "1px solid var(--border, #e5e7eb)",
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  } as React.CSSProperties,

  controls: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap" as const,
    marginBottom: 20,
  } as React.CSSProperties,

  select: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--border, #d1d5db)",
    fontSize: 14,
    background: "var(--surface, #fff)",
    minWidth: 160,
  } as React.CSSProperties,

  btn: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  btnPrimary: {
    background: "var(--primary, #6366f1)",
    color: "#fff",
  } as React.CSSProperties,

  btnSuccess: {
    background: "#10b981",
    color: "#fff",
  } as React.CSSProperties,

  btnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,

  imageContainer: {
    position: "relative" as const,
    display: "inline-block",
    maxWidth: "100%",
  } as React.CSSProperties,

  previewImage: {
    maxWidth: "100%",
    maxHeight: 500,
    borderRadius: 8,
    display: "block",
  } as React.CSSProperties,

  facesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 16,
    marginTop: 20,
  } as React.CSSProperties,

  faceCard: {
    background: "var(--surface, #fff)",
    borderRadius: 12,
    border: "1px solid var(--border, #e5e7eb)",
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  } as React.CSSProperties,

  badge: (color: string) =>
    ({
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 99,
      fontSize: 12,
      fontWeight: 700,
      color: "#fff",
      background: color,
      marginRight: 8,
    }) as React.CSSProperties,

  candidateRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid var(--border, #f3f4f6)",
  } as React.CSSProperties,

  candidateAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    objectFit: "cover" as const,
    background: "#e5e7eb",
    flexShrink: 0,
  } as React.CSSProperties,

  summary: {
    padding: 16,
    borderRadius: 12,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    marginTop: 20,
  } as React.CSSProperties,

  error: {
    padding: 16,
    borderRadius: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    marginTop: 12,
  } as React.CSSProperties,

  warning: {
    padding: 12,
    borderRadius: 8,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#b45309",
    fontSize: 13,
    marginTop: 8,
  } as React.CSSProperties,

  spinner: {
    display: "inline-block",
    width: 18,
    height: 18,
    border: "2px solid #fff",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
    marginRight: 8,
    verticalAlign: "middle",
  } as React.CSSProperties,
};

function statusColor(status: string): string {
  if (status === "LIVE") return "#10b981";
  if (status === "SPOOF") return "#ef4444";
  return "#f59e0b";
}

interface FaceSelection {
  faceIndex: number;
  personId: string | null;
  personType: "EMPLOYEE" | "WORKER" | null;
}

export function FaceAttendancePage(): React.ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Face AI Circuit Breaker & Health state
  const [faceAiStatus, setFaceAiStatus] = useState<{
    online: boolean;
    circuitBreakerState?: "CLOSED" | "OPEN" | "HALF_OPEN";
    message?: string;
    fallbackMode?: "MANUAL_ATTENDANCE" | null;
  } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Farm & Shed selection
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [farmsLoaded, setFarmsLoaded] = useState(false);

  const [sheds, setSheds] = useState<Shed[]>([]);
  const [selectedShedId, setSelectedShedId] = useState<string>("");

  // Shift Selection
  const [selectedShift, setSelectedShift] = useState<Shift>("MORNING_SHIFT");

  // GPS Location State
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>("Fetching GPS location…");

  // Camera state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Image & processing
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<FrameProcessResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    markedCount: number;
    duplicateCount: number;
  } | null>(null);

  // Face identity selections
  const [selections, setSelections] = useState<FaceSelection[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. High accuracy GPS Location acquisition with fresh fix (maximumAge: 0)
  const requestGpsLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("📍 Geolocation not supported by browser");
      return;
    }
    setLocationStatus("📡 Requesting fresh GPS location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocationStatus(
          `📍 GPS Fixed: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)} (±${Math.round(pos.coords.accuracy)}m)`,
        );
      },
      (err) => {
        setLocationStatus(`⚠️ GPS Error (${err.message || "Denied/Timeout"}). Defaulting to 0,0.`);
        setLocation({ latitude: 0, longitude: 0 });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }, []);

  useEffect(() => {
    requestGpsLocation();
  }, [requestGpsLocation]);

  // Health-aware Circuit Breaker Check
  const checkFaceAiHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/face-ai/health");
      const data = await res.json().catch(() => null);
      if (
        data?.circuitBreaker?.state === "OPEN" ||
        data?.serviceStatus === "offline" ||
        data?.fallbackMode === "MANUAL_ATTENDANCE"
      ) {
        setFaceAiStatus({
          online: false,
          circuitBreakerState: data?.circuitBreaker?.state ?? "OPEN",
          message: data?.message || "Face AI biometric service is unavailable.",
          fallbackMode: "MANUAL_ATTENDANCE",
        });
      } else {
        setFaceAiStatus({
          online: true,
          circuitBreakerState: data?.circuitBreaker?.state ?? "CLOSED",
          fallbackMode: null,
        });
      }
    } catch {
      setFaceAiStatus({
        online: false,
        circuitBreakerState: "OPEN",
        message: "Unable to connect to Face AI service.",
        fallbackMode: "MANUAL_ATTENDANCE",
      });
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    checkFaceAiHealth();
  }, [checkFaceAiHealth]);

  // 2. Load farms once
  if (!farmsLoaded) {
    setFarmsLoaded(true);
    apiClient
      .get<{ farms: Farm[] }>("/farms")
      .then((data) => {
        const list = data?.farms || [];
        setFarms(list);
        if (user?.scope?.farmId && list.some((f) => f.id === user.scope.farmId)) {
          setSelectedFarmId(user.scope.farmId);
        } else if (list.length > 0 && list[0]) {
          setSelectedFarmId(list[0].id);
        }
      })
      .catch(() => {});
  }

  // 3. Load Sheds when Farm changes
  useEffect(() => {
    if (!selectedFarmId) {
      setSheds([]);
      setSelectedShedId("");
      return;
    }

    fetchSheds({ farmId: selectedFarmId })
      .then((list) => {
        setSheds(list || []);
        if (list?.length === 1 && list[0]) {
          setSelectedShedId(list[0].id);
        } else {
          setSelectedShedId("");
        }
      })
      .catch(() => {
        setSheds([]);
      });
  }, [selectedFarmId]);

  // Camera cleanup
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Attach stream to video element once cameraActive renders the video tag or facingMode changes
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, facingMode]);

  const startCamera = async (targetFacingMode?: "user" | "environment") => {
    setCameraError(null);
    setImagePreviewUrl(null);
    setResult(null);
    setSubmitResult(null);
    setError(null);
    const modeToUse = targetFacingMode || facingMode;
    setFacingMode(modeToUse);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const isBackCamera = modeToUse === "environment";

    // 16:9 widescreen for back camera; portrait for front camera
    const videoConstraints: MediaTrackConstraints = isBackCamera
      ? {
          facingMode: { ideal: "environment" },
          aspectRatio: { ideal: 16 / 9 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      : {
          facingMode: { ideal: "user" },
          aspectRatio: { ideal: 3 / 4 },
          width: { ideal: 720 },
          height: { ideal: 960 },
        };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      try {
        const fallbackConstraints: MediaTrackConstraints = isBackCamera
          ? { facingMode: { ideal: "environment" } }
          : { facingMode: { ideal: "user" } };
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: fallbackConstraints,
        });
        streamRef.current = fallbackStream;
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr: any) {
        try {
          const genericStream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = genericStream;
          setCameraActive(true);
          if (videoRef.current) {
            videoRef.current.srcObject = genericStream;
            videoRef.current.play().catch(() => {});
          }
        } catch (lastErr: any) {
          setCameraError(
            err.name === "NotAllowedError" ||
              fallbackErr.name === "NotAllowedError" ||
              lastErr.name === "NotAllowedError"
              ? "Camera access denied. Please grant permission."
              : "Could not open camera: " + (err.message || fallbackErr.message || lastErr.message || "Unknown error"),
          );
          stopCamera();
        }
      }
    }
  };

  const toggleCamera = async () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    await startCamera(nextFacing);
  };

  const captureFrameAndProcess = async () => {
    if (!selectedFarmId) {
      setError("Please select a farm first.");
      return;
    }

    let fileToProcess: File | null = null;

    if (cameraActive && videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const isBack = facingMode === "environment";
      const vw = video.videoWidth || (isBack ? 1280 : 720);
      const vh = video.videoHeight || (isBack ? 720 : 960);
      const currentRatio = vw / vh;

      let sx = 0;
      let sy = 0;
      let sWidth = vw;
      let sHeight = vh;

      if (isBack) {
        // Back camera: strictly 16:9 ratio matching widescreen viewfinder
        const targetRatio = 16 / 9;
        if (Math.abs(currentRatio - targetRatio) > 0.02) {
          if (currentRatio < targetRatio) {
            // Source stream is taller than 16:9 (e.g. mobile sensor held in portrait)
            sWidth = vw;
            sHeight = Math.round(vw / targetRatio);
            sx = 0;
            sy = Math.round((vh - sHeight) / 2);
          } else {
            // Source stream is wider than 16:9
            sHeight = vh;
            sWidth = Math.round(vh * targetRatio);
            sy = 0;
            sx = Math.round((vw - sWidth) / 2);
          }
        }
      } else {
        // Front camera: portrait ratio matching viewfinder
        if (currentRatio > 1) {
          // Source is landscape (e.g. desktop webcam), crop center to 3:4 portrait
          const targetRatio = 3 / 4;
          sHeight = vh;
          sWidth = Math.round(vh * targetRatio);
          sy = 0;
          sx = Math.round((vw - sWidth) / 2);
        }
      }

      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.95),
        );
        if (blob) {
          fileToProcess = new File([blob], "camera_capture.jpg", {
            type: "image/jpeg",
          });
          setImagePreviewUrl(URL.createObjectURL(blob));
          stopCamera();
        }
      }
    }

    if (!fileToProcess) {
      setError("No camera frame or image file available.");
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);
    setSubmitResult(null);

    try {
      const res = await processFrame(fileToProcess, selectedFarmId);
      setResult(res);

      const sels: FaceSelection[] = res.faces.map((face) => {
        const topCandidate = face.candidates[0];
        if (topCandidate && topCandidate.similarity >= 0.4) {
          return {
            faceIndex: face.faceIndex,
            personId: topCandidate.id,
            personType: topCandidate.personType,
          };
        }
        return { faceIndex: face.faceIndex, personId: null, personType: null };
      });
      setSelections(sels);
    } catch (err: any) {
      const errMsg = err?.message || "";
      const isConnectionError =
        err?.code === "FACE_AI_CIRCUIT_OPEN" ||
        errMsg.includes("circuit breaker") ||
        (errMsg.includes("Face AI service is unavailable") && (err?.status === 503 || err?.status === 502)) ||
        errMsg.includes("ECONNREFUSED") ||
        err?.status === 503 ||
        err?.status === 502;

      if (isConnectionError) {
        setFaceAiStatus({
          online: false,
          circuitBreakerState: "OPEN",
          message: errMsg,
          fallbackMode: "MANUAL_ATTENDANCE",
        });
        setError(errMsg || "Face AI biometric service is temporarily unavailable.");
      } else {
        // Image decoding, validation, or recognition error — guide user to cleaner image
        if (
          errMsg.includes("decode") ||
          errMsg.includes("corrupt") ||
          errMsg.includes("format") ||
          errMsg.includes("Image processing") ||
          err?.status === 400 ||
          err?.status === 422
        ) {
          setError("Unable to process this image. Please upload or capture a clearer, standard photo (JPG, PNG, or WEBP) with good lighting.");
        } else {
          setError(errMsg || "Failed to process face frame. Please try taking another photo.");
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFarmId) return;

    stopCamera();
    setImagePreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setSubmitResult(null);
    setError(null);
    setSelections([]);

    setProcessing(true);
    try {
      const res = await processFrame(file, selectedFarmId);
      setResult(res);

      const sels: FaceSelection[] = res.faces.map((face) => {
        const topCandidate = face.candidates[0];
        if (topCandidate && topCandidate.similarity >= 0.4) {
          return {
            faceIndex: face.faceIndex,
            personId: topCandidate.id,
            personType: topCandidate.personType,
          };
        }
        return { faceIndex: face.faceIndex, personId: null, personType: null };
      });
      setSelections(sels);
    } catch (err: any) {
      const errMsg = err?.message || "";
      const isConnectionError =
        err?.code === "FACE_AI_CIRCUIT_OPEN" ||
        errMsg.includes("circuit breaker") ||
        (errMsg.includes("Face AI service is unavailable") && (err?.status === 503 || err?.status === 502)) ||
        errMsg.includes("ECONNREFUSED") ||
        err?.status === 503 ||
        err?.status === 502;

      if (isConnectionError) {
        setFaceAiStatus({
          online: false,
          circuitBreakerState: "OPEN",
          message: errMsg,
          fallbackMode: "MANUAL_ATTENDANCE",
        });
        setError(errMsg || "Face AI biometric service is temporarily unavailable.");
      } else {
        // Image decoding, validation, or recognition error — guide user to cleaner image
        if (
          errMsg.includes("decode") ||
          errMsg.includes("corrupt") ||
          errMsg.includes("format") ||
          errMsg.includes("Image processing") ||
          err?.status === 400 ||
          err?.status === 422
        ) {
          setError("Unable to process this image. Please upload or capture a clearer, standard photo (JPG, PNG, or WEBP) with good lighting.");
        } else {
          setError(errMsg || "Failed to process image. Please try uploading a cleaner photo.");
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectionChange = useCallback(
    (faceIndex: number, candidateId: string, personType: "EMPLOYEE" | "WORKER") => {
      setSelections((prev) =>
        prev.map((s) =>
          s.faceIndex === faceIndex
            ? { ...s, personId: candidateId, personType }
            : s,
        ),
      );
    },
    [],
  );

  const acRoomShed = sheds.find(
    (s) => s.number.toLowerCase() === "ac room" || s.number.toLowerCase().includes("ac room"),
  );
  const regularSheds = sheds.filter((s) => s.id !== acRoomShed?.id);

  const handleSubmitAttendance = useCallback(async () => {
    if (!result) return;

    // Shift timing verification check
    const timingValidation = validateShiftTiming(selectedShift);
    if (!timingValidation.allowed) {
      setError(timingValidation.message || "Attendance submission blocked due to shift timing restriction.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const records: FaceAttendanceRecord[] = [];

    const lat = location?.latitude ?? 0;
    const lng = location?.longitude ?? 0;

    const resolvedShedId =
      selectedShedId === "AC_ROOM"
        ? (acRoomShed?.id ?? "AC_ROOM")
        : (selectedShedId || undefined);

    for (const sel of selections) {
      if (!sel.personId || !sel.personType) continue;

      const face = result.faces.find((f) => f.faceIndex === sel.faceIndex);
      if (!face) continue;

      const topCandidate = face.candidates.find((c) => c.id === sel.personId);

      const record: FaceAttendanceRecord = {
        employeeId: sel.personType === "EMPLOYEE" ? sel.personId : undefined,
        workerId: sel.personType === "WORKER" ? sel.personId : undefined,
        shedId: resolvedShedId,
        date: today,
        shift: selectedShift,
        status: "PRESENT",
        latitude: lat,
        longitude: lng,
        livenessScore: face.livenessScore ?? undefined,
        qualityScore: face.qualityScore ?? undefined,
        confidenceScore: topCandidate?.similarity ?? undefined,
      };

      records.push(record);
    }

    if (records.length === 0) {
      setError("No faces selected for attendance marking");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await bulkMarkFaceAttendance(records);
      setSubmitResult({
        markedCount: res.markedCount,
        duplicateCount: res.duplicateCount,
      });
    } catch (err: any) {
      setError(err.message || "Failed to submit attendance");
    } finally {
      setSubmitting(false);
    }
  }, [result, selections, selectedShift, selectedShedId, location, acRoomShed]);

  const confirmedCount = selections.filter((s) => s.personId).length;
  const liveFaces = result?.faces.filter((f) => f.status === "LIVE") ?? [];
  const shiftCheck = validateShiftTiming(selectedShift);

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={styles.header}>
        <h1 style={styles.title}>🎯 Live Face Attendance</h1>
        <p style={styles.subtitle}>
          Capture live camera faces, verify shift window & GPS location, and mark attendance
        </p>
      </div>

      {/* Circuit Breaker Fail-Open Alert Banner */}
      {faceAiStatus?.fallbackMode === "MANUAL_ATTENDANCE" && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
            boxShadow: "0 2px 8px rgba(245, 158, 11, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 260, flex: 1 }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 700, color: "#92400e", fontSize: 15 }}>
                Face AI Biometric Service Unavailable (Circuit Breaker: OPEN)
              </div>
              <div style={{ color: "#b45309", fontSize: 13, marginTop: 3 }}>
                The biometric model is offline or has encountered high error rates. Operations continue seamlessly:
                the system has failed open to manual attendance mode.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              style={{
                background: "#d97706",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "10px 18px",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(217, 119, 6, 0.3)",
              }}
              onClick={() => navigate("/attendance")}
            >
              📋 Switch to Manual Attendance &rarr;
            </button>
            <button
              type="button"
              style={{
                background: "#ffffff",
                color: "#78350f",
                border: "1px solid #fcd34d",
                borderRadius: 8,
                padding: "10px 14px",
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
              }}
              disabled={checkingHealth}
              onClick={checkFaceAiHealth}
            >
              {checkingHealth ? "Probing..." : "🔄 Retry Connection"}
            </button>
          </div>
        </div>
      )}

      {/* Controls Header */}
      <div style={styles.controls} className="face-controls">
        {/* Farm Select */}
        <select
          style={styles.select}
          value={selectedFarmId}
          onChange={(e) => setSelectedFarmId(e.target.value)}
        >
          <option value="">Select Farm</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.code})
            </option>
          ))}
        </select>

        {/* Shed Select */}
        <select
          style={styles.select}
          value={selectedShedId}
          disabled={!selectedFarmId}
          onChange={(e) => setSelectedShedId(e.target.value)}
        >
          <option value="">🏢 General / Unassigned</option>
          {acRoomShed ? (
            <option value={acRoomShed.id}>❄️ AC Room</option>
          ) : (
            <option value="AC_ROOM">❄️ AC Room</option>
          )}
          {regularSheds.map((s) => (
            <option key={s.id} value={s.id}>
              {s.number.toLowerCase().startsWith("shed")
                ? s.number.replace("-", " ")
                : `Shed ${s.number}`}
            </option>
          ))}
        </select>

        {/* Shift Select */}
        <select
          style={styles.select}
          value={selectedShift}
          onChange={(e) => setSelectedShift(e.target.value as Shift)}
        >
          {SHIFTS.map((sh) => (
            <option key={sh} value={sh}>
              {shiftLabel(sh)}
            </option>
          ))}
        </select>

        {/* Camera Select */}
        <select
          style={styles.select}
          value={facingMode}
          onChange={(e) => {
            const newFacing = e.target.value as "user" | "environment";
            setFacingMode(newFacing);
            if (cameraActive) {
              startCamera(newFacing);
            }
          }}
        >
          <option value="user">📷 Front Camera (Portrait)</option>
          <option value="environment">📸 Back Camera (16:9 Widescreen)</option>
        </select>
      </div>

      {/* GPS & Shift Status Info Banner */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ ...styles.card, flex: 1, padding: "10px 16px", marginBottom: 0, fontSize: 13, background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span><strong>{locationStatus}</strong></span>
          <button
            type="button"
            style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
            onClick={requestGpsLocation}
          >
            🔄 Refresh GPS
          </button>
        </div>
        {!shiftCheck.allowed && (
          <div style={{ ...styles.card, flex: 2, padding: 12, marginBottom: 0, ...styles.warning }}>
            ⚠️ <strong>Shift Timing Warning:</strong> {shiftCheck.message}
          </div>
        )}
      </div>

      {/* Viewfinder Card */}
      <div style={styles.card}>
        {cameraError && <div style={styles.error}>⚠️ {cameraError}</div>}

        {cameraActive && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                ...styles.imageContainer,
                width: "100%",
                maxWidth: facingMode === "environment" ? 920 : 420,
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  maxWidth: facingMode === "environment" ? 920 : 420,
                  aspectRatio: facingMode === "environment" ? "16 / 9" : "3 / 4",
                  objectFit: "cover",
                  borderRadius: 12,
                  background: "#000",
                  display: "block",
                  margin: "0 auto",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
                }}
              />
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
              {facingMode === "environment"
                ? "📸 Back Camera (16:9 Widescreen) — Position workers across the frame"
                : "📷 Front Camera (Portrait) — Position face clearly inside the frame"}
              {" and click "}
              <strong>Capture & Recognize</strong>.
            </p>
          </div>
        )}

        {!cameraActive && imagePreviewUrl && (
          <div style={{ textAlign: "center" }}>
            <div style={styles.imageContainer}>
              <img src={imagePreviewUrl} alt="Captured frame" style={styles.previewImage} />

              {/* Bounding box overlay */}
              {result && (
                <svg
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                  viewBox={`0 0 ${result.imageWidth} ${result.imageHeight}`}
                  preserveAspectRatio="none"
                >
                  {result.faces.map((face) => {
                    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = face.bbox;
                    const color = statusColor(face.status);
                    const selectedId = selections.find((s) => s.faceIndex === face.faceIndex)?.personId;
                    const matched =
                      face.candidates.find((c) => c.id === selectedId) ||
                      (face.candidates[0] && face.candidates[0].similarity >= 0.4 ? face.candidates[0] : null);

                    const scale = Math.max(0.65, result.imageWidth / 900);
                    const strokeWidth = Math.max(3, result.imageWidth * 0.0035);
                    const badgeHeight = 48 * scale;
                    const avatarSize = 36 * scale;
                    const fontSizeName = 15 * scale;
                    const fontSizeSub = 11 * scale;
                    const padding = 6 * scale;
                    const badgeWidth = Math.max(x2 - x1, 220 * scale);
                    const badgeX = Math.max(4, Math.min(x1, result.imageWidth - badgeWidth - 4));
                    // Place above bounding box if fits, else below bbox, clamped inside image
                    const badgeY =
                      y1 - badgeHeight - 8 < 0
                        ? Math.min(result.imageHeight - badgeHeight - 4, y2 + 8)
                        : y1 - badgeHeight - 8;

                    return (
                      <g key={face.faceIndex}>
                        {/* Face Bounding Box */}
                        <rect
                          x={x1}
                          y={y1}
                          width={x2 - x1}
                          height={y2 - y1}
                          fill="none"
                          stroke={color}
                          strokeWidth={strokeWidth}
                          rx={8 * scale}
                        />

                        {/* Floating Identity Badge */}
                        <g>
                          <defs>
                            <clipPath id={`avatar-clip-${face.faceIndex}`}>
                              <circle
                                cx={badgeX + padding + avatarSize / 2}
                                cy={badgeY + badgeHeight / 2}
                                r={avatarSize / 2}
                              />
                            </clipPath>
                          </defs>

                          <rect
                            x={badgeX}
                            y={badgeY}
                            width={badgeWidth}
                            height={badgeHeight}
                            rx={8 * scale}
                            fill="rgba(15, 23, 42, 0.92)"
                            stroke={color}
                            strokeWidth={Math.max(1.5, strokeWidth * 0.6)}
                          />

                          {matched ? (
                            <>
                              {/* Avatar in badge */}
                              {matched.photoUrl ? (
                                <image
                                  href={matched.photoUrl}
                                  x={badgeX + padding}
                                  y={badgeY + (badgeHeight - avatarSize) / 2}
                                  width={avatarSize}
                                  height={avatarSize}
                                  clipPath={`url(#avatar-clip-${face.faceIndex})`}
                                  preserveAspectRatio="xMidYMid slice"
                                />
                              ) : (
                                <circle
                                  cx={badgeX + padding + avatarSize / 2}
                                  cy={badgeY + badgeHeight / 2}
                                  r={avatarSize / 2}
                                  fill="#6366f1"
                                />
                              )}
                              {!matched.photoUrl && (
                                <text
                                  x={badgeX + padding + avatarSize / 2}
                                  y={badgeY + badgeHeight / 2 + 5 * scale}
                                  textAnchor="middle"
                                  fill="#ffffff"
                                  fontSize={fontSizeName * 0.9}
                                  fontWeight="bold"
                                >
                                  {matched.name.charAt(0).toUpperCase()}
                                </text>
                              )}

                              {/* Recognized Name */}
                              <text
                                x={badgeX + padding + avatarSize + 8 * scale}
                                y={badgeY + padding + fontSizeName}
                                fill="#ffffff"
                                fontSize={fontSizeName}
                                fontWeight="bold"
                              >
                                {matched.name}
                              </text>

                              {/* Match percentage & role */}
                              <text
                                x={badgeX + padding + avatarSize + 8 * scale}
                                y={badgeY + padding + fontSizeName + fontSizeSub + 4 * scale}
                                fill={matched.similarity >= 0.6 ? "#34d399" : "#fbbf24"}
                                fontSize={fontSizeSub}
                                fontWeight="600"
                              >
                                {Math.round(matched.similarity * 100)}% Match • {matched.personType}
                              </text>
                            </>
                          ) : (
                            <text
                              x={badgeX + 12 * scale}
                              y={badgeY + badgeHeight / 2 + 5 * scale}
                              fill={color}
                              fontSize={fontSizeName}
                              fontWeight="bold"
                            >
                              Face #{face.faceIndex} — {face.status === "LIVE" ? "Unrecognized" : face.status}
                            </text>
                          )}
                        </g>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        )}

        {!cameraActive && !imagePreviewUrl && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--surface-secondary, #f9fafb)",
              borderRadius: 12,
              border: "2px dashed #d1d5db",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎥</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
              Live Camera Ready
            </h3>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
              Select a farm and start the live camera or upload an image to begin face recognition.
            </p>
          </div>
        )}

        {/* Camera & Capture Action Buttons — Directly under the camera feed */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--border, #f3f4f6)",
          }}
          className="face-capture-actions"
        >
          {!cameraActive ? (
            <button
              style={{ ...styles.btn, ...styles.btnPrimary, padding: "12px 24px", fontSize: 15 }}
              onClick={() => startCamera()}
            >
              {imagePreviewUrl ? "📸 Retake / Open Live Camera" : "🎥 Start Live Camera"}
            </button>
          ) : (
            <>
              <button
                style={{
                  ...styles.btn,
                  ...styles.btnPrimary,
                  background: "#4f46e5",
                  fontSize: 16,
                  padding: "12px 28px",
                  boxShadow: "0 4px 12px rgba(79, 70, 229, 0.35)",
                  ...(processing || !selectedFarmId ? styles.btnDisabled : {}),
                }}
                disabled={processing || !selectedFarmId}
                onClick={captureFrameAndProcess}
              >
                {processing && <span style={styles.spinner} />}
                {processing ? "Analyzing Frame…" : "📸 Capture & Recognize"}
              </button>
              <button
                style={{ ...styles.btn, background: "#e0e7ff", color: "#3730a3" }}
                onClick={toggleCamera}
                title="Switch between front and back camera"
              >
                🔄 {facingMode === "user" ? "Use Back Cam (16:9)" : "Use Front Cam (Portrait)"}
              </button>
              <button
                style={{ ...styles.btn, background: "#fee2e2", color: "#991b1b" }}
                onClick={stopCamera}
              >
                ⏹ Stop Camera
              </button>
            </>
          )}

          <button
            style={{ ...styles.btn, background: "#f3f4f6", color: "#374151" }}
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Upload Image
          </button>

          {result && liveFaces.length > 0 && (
            <button
              style={{
                ...styles.btn,
                ...styles.btnSuccess,
                fontSize: 16,
                padding: "12px 28px",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
                ...(submitting || confirmedCount === 0 || !shiftCheck.allowed
                  ? styles.btnDisabled
                  : {}),
              }}
              disabled={submitting || confirmedCount === 0 || !shiftCheck.allowed}
              onClick={handleSubmitAttendance}
            >
              {submitting && <span style={styles.spinner} />}
              ✅ Mark Attendance ({confirmedCount})
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
      </div>

      {/* Processing stats */}
      {result && (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div style={{ ...styles.card, flex: 1, minWidth: 140, textAlign: "center", marginBottom: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#6366f1" }}>
              {result.faceCount}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Faces Detected</div>
          </div>
          <div style={{ ...styles.card, flex: 1, minWidth: 140, textAlign: "center", marginBottom: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>
              {liveFaces.length}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Live Faces</div>
          </div>
          <div style={{ ...styles.card, flex: 1, minWidth: 140, textAlign: "center", marginBottom: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>
              {result.processTimeMs.toFixed(0)}ms
            </div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Process Time</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            ...styles.error,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span>⚠️ {error}</span>
          {(error.toLowerCase().includes("manual attendance") ||
            error.toLowerCase().includes("circuit breaker") ||
            error.toLowerCase().includes("unavailable") ||
            error.toLowerCase().includes("offline")) && (
            <button
              type="button"
              style={{
                background: "#b91c1c",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(185, 28, 28, 0.25)",
              }}
              onClick={() => navigate("/attendance")}
            >
              📋 Open Manual Attendance &rarr;
            </button>
          )}
        </div>
      )}

      {/* Submit result */}
      {submitResult && (
        <div style={styles.summary}>
          <strong>✅ Attendance Submitted!</strong>
          <p style={{ margin: "4px 0 0" }}>
            {submitResult.markedCount} marked
            {submitResult.duplicateCount > 0 &&
              ` • ${submitResult.duplicateCount} already recorded`}
          </p>
        </div>
      )}

      {/* No faces detected notice */}
      {result && result.faceCount === 0 && (
        <div
          style={{
            ...styles.card,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            padding: "20px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontWeight: 700, color: "#92400e", fontSize: 16 }}>
            No Faces Detected in Image
          </div>
          <div style={{ color: "#b45309", fontSize: 14, marginTop: 6, maxWidth: 600, margin: "6px auto 0" }}>
            We could not detect any faces in this photo. Please upload or capture a clearer, front-facing photo with adequate lighting and visible faces.
          </div>
        </div>
      )}

      {/* Faces detected but none usable (low quality / blur / extreme angle / spoof) */}
      {result && result.faceCount > 0 && liveFaces.length === 0 && (
        <div
          style={{
            ...styles.card,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "20px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: "#991b1b", fontSize: 16 }}>
            Faces Detected but Cannot Be Verified
          </div>
          <div style={{ color: "#b91c1c", fontSize: 14, marginTop: 6, maxWidth: 600, margin: "6px auto 0" }}>
            The detected face(s) did not meet the sharpness or quality requirements. Please take or upload a cleaner, well-lit image with personnel looking directly at the camera.
          </div>
        </div>
      )}

      {/* Face Cards */}
      {result && result.faces.length > 0 && (
        <div style={styles.facesGrid}>
          {result.faces.map((face) => (
            <FaceCard
              key={face.faceIndex}
              face={face}
              selection={selections.find(
                (s) => s.faceIndex === face.faceIndex,
              )}
              onSelect={handleSelectionChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Person Avatar with Fallback                                        */
/* ------------------------------------------------------------------ */

function PersonAvatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name: string;
  size?: number;
}): React.ReactElement {
  const [imgError, setImgError] = useState(false);
  const initials = name
    ? name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: "2px solid #e0e7ff",
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.38)),
        border: "2px solid #e0e7ff",
        flexShrink: 0,
        textTransform: "uppercase",
      }}
    >
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Face Card                                                          */
/* ------------------------------------------------------------------ */

function FaceCard({
  face,
  selection,
  onSelect,
}: {
  face: ProcessedFace;
  selection?: FaceSelection | undefined;
  onSelect: (
    faceIndex: number,
    candidateId: string,
    personType: "EMPLOYEE" | "WORKER",
  ) => void;
}): React.ReactElement {
  const isLive = face.status === "LIVE";
  const activeCandidate =
    face.candidates.find((c) => c.id === selection?.personId) ||
    (face.candidates[0] && face.candidates[0].similarity >= 0.4 ? face.candidates[0] : null);

  return (
    <div style={styles.faceCard}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          Face #{face.faceIndex}
        </span>
        <span style={styles.badge(statusColor(face.status))}>
          {face.status}
        </span>
      </div>

      {/* Prominent Recognized Person Hero Identity Badge */}
      {isLive && activeCandidate && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 12,
            borderRadius: 10,
            background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
            border: "1px solid #a7f3d0",
            marginBottom: 14,
            boxShadow: "0 1px 3px rgba(16, 185, 129, 0.1)",
          }}
        >
          <PersonAvatar src={activeCandidate.photoUrl} name={activeCandidate.name} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#065f46" }}>
                {activeCandidate.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: activeCandidate.similarity >= 0.6 ? "#10b981" : "#f59e0b",
                  color: "#fff",
                }}
              >
                {Math.round(activeCandidate.similarity * 100)}% Match
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#047857", marginTop: 2 }}>
              {activeCandidate.personCode} • {activeCandidate.personType}
            </div>
          </div>
        </div>
      )}

      {/* Unrecognized Face Banner */}
      {isLive && !activeCandidate && face.candidates.length === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 10,
            background: "#fef3c7",
            border: "1px solid #fde68a",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#f59e0b",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ?
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>
              Unrecognized Face
            </div>
            <div style={{ fontSize: 12, color: "#b45309" }}>
              No matching person found in enrolled facial database
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 12,
          fontSize: 13,
          color: "#6b7280",
        }}
      >
        {face.qualityScore != null && (
          <span>
            Quality: <strong>{(face.qualityScore * 100).toFixed(0)}%</strong>
          </span>
        )}
        {face.livenessScore != null && (
          <span>
            Liveness: <strong>{(face.livenessScore * 100).toFixed(0)}%</strong>
          </span>
        )}
      </div>

      {/* Candidates */}
      {isLive && face.candidates.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            Candidate Matches
          </div>
          {face.candidates.map((c) => {
            const pct = Math.round(c.similarity * 100);
            const isSelected = selection?.personId === c.id;

            return (
              <div
                key={c.id}
                style={{
                  ...styles.candidateRow,
                  cursor: "pointer",
                  background: isSelected
                    ? "rgba(99,102,241,0.08)"
                    : "transparent",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
                onClick={() =>
                  onSelect(face.faceIndex, c.id, c.personType)
                }
              >
                {/* Radio */}
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: `2px solid ${isSelected ? "#6366f1" : "#d1d5db"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected && (
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#6366f1",
                      }}
                    />
                  )}
                </div>

                {/* Avatar with fallback */}
                <PersonAvatar src={c.photoUrl} name={c.name} size={38} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    {c.personCode} • {c.personType}
                  </div>
                </div>

                {/* Similarity */}
                <div style={{ textAlign: "right", minWidth: 50 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: pct >= 60 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444",
                    }}
                  >
                    {pct}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLive && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background:
              face.status === "SPOOF" ? "#fef2f2" : "#fefce8",
            fontSize: 13,
            color: face.status === "SPOOF" ? "#991b1b" : "#854d0e",
          }}
        >
          {face.status === "SPOOF"
            ? "🚫 Spoof detected — this face will not be matched"
            : "⚠️ Low quality image — please try a clearer photo"}
        </div>
      )}
    </div>
  );
}
