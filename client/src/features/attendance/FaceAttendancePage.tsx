import { useCallback, useEffect, useRef, useState } from "react";
import type { Farm, Shed, Shift } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { apiClient } from "../../api/client.js";
import { fetchSheds } from "../../api/resources.js";
import {
  processFrame,
  bulkMarkFaceAttendance,
  type ProcessedFace,
  type FrameProcessResult,
  type FaceAttendanceRecord,
} from "../../api/face-attendance.api.js";

/* ------------------------------------------------------------------ */
/*  Shift Timing Helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Standard shift timings:
 * - MORNING_SHIFT:   05:00 - 15:00 (5 AM to 3 PM, includes 1hr buffer)
 * - AFTERNOON_SHIFT: 13:00 - 23:00 (1 PM to 11 PM, includes 1hr buffer)
 * - NIGHT_SHIFT:     21:00 - 07:00 (9 PM to 7 AM, includes 1hr buffer)
 * - OVERTIME:        Allowed anytime
 */
function validateShiftTiming(shift: Shift): { allowed: boolean; message?: string } {
  if (shift === "OVERTIME") return { allowed: true };

  const now = new Date();
  const currentHour = now.getHours();

  switch (shift) {
    case "MORNING_SHIFT": {
      // 05:00 to 15:00
      if (currentHour < 5 || currentHour >= 15) {
        return {
          allowed: false,
          message: `Morning Shift attendance is only allowed between 05:00 AM and 03:00 PM. Current time is ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        };
      }
      break;
    }
    case "AFTERNOON_SHIFT": {
      // 13:00 to 23:00
      if (currentHour < 13 || currentHour >= 23) {
        return {
          allowed: false,
          message: `Afternoon Shift attendance is only allowed between 01:00 PM and 11:00 PM. Current time is ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        };
      }
      break;
    }
    case "NIGHT_SHIFT": {
      // 21:00 to 07:00 (crosses midnight)
      if (currentHour >= 7 && currentHour < 21) {
        return {
          allowed: false,
          message: `Night Shift attendance is only allowed between 09:00 PM and 07:00 AM. Current time is ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        };
      }
      break;
    }
  }

  return { allowed: true };
}

function shiftLabel(shift: Shift): string {
  switch (shift) {
    case "MORNING_SHIFT":
      return "Morning Shift (05:00 - 15:00)";
    case "AFTERNOON_SHIFT":
      return "Afternoon Shift (13:00 - 23:00)";
    case "NIGHT_SHIFT":
      return "Night Shift (21:00 - 07:00)";
    case "OVERTIME":
      return "Overtime (Anytime)";
  }
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

  // 2. Load farms once
  if (!farmsLoaded) {
    setFarmsLoaded(true);
    apiClient
      .get<{ farms: Farm[] }>("/farms")
      .then((data) => {
        const list = data?.farms || [];
        setFarms(list);
        if (list.length === 1 && list[0]) {
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: modeToUse } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = fallbackStream;
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr: any) {
        setCameraError(
          err.name === "NotAllowedError" || fallbackErr.name === "NotAllowedError"
            ? "Camera access denied. Please grant permission."
            : "Could not open camera: " + (err.message || fallbackErr.message || "Unknown error"),
        );
        stopCamera();
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
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.95),
        );
        if (blob) {
          fileToProcess = new File([blob], "camera_capture.jpg", {
            type: "image/jpeg",
          });
          setImagePreviewUrl(URL.createObjectURL(blob));
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
        if (topCandidate && topCandidate.similarity >= 0.6) {
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
      setError(err.message || "Failed to process face frame");
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
        if (topCandidate && topCandidate.similarity >= 0.6) {
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
      setError(err.message || "Failed to process image");
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

    for (const sel of selections) {
      if (!sel.personId || !sel.personType) continue;

      const face = result.faces.find((f) => f.faceIndex === sel.faceIndex);
      if (!face) continue;

      const topCandidate = face.candidates.find((c) => c.id === sel.personId);

      const record: FaceAttendanceRecord = {
        employeeId: sel.personType === "EMPLOYEE" ? sel.personId : undefined,
        workerId: sel.personType === "WORKER" ? sel.personId : undefined,
        shedId: selectedShedId || undefined,
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
  }, [result, selections, selectedShift, selectedShedId, location]);

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

      {/* Controls Header */}
      <div style={styles.controls}>
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
          disabled={!selectedFarmId || sheds.length === 0}
          onChange={(e) => setSelectedShedId(e.target.value)}
        >
          <option value="">All Sheds / Unassigned</option>
          {sheds.map((s) => (
            <option key={s.id} value={s.id}>
              Shed {s.number}
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
          <option value="user">📷 Front Camera</option>
          <option value="environment">📸 Back Camera</option>
        </select>

        {/* Camera Actions */}
        {!cameraActive ? (
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={() => startCamera()}
          >
            🎥 Start Live Camera
          </button>
        ) : (
          <>
            <button
              style={{
                ...styles.btn,
                ...styles.btnPrimary,
                background: "#4f46e5",
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
              🔄 {facingMode === "user" ? "Use Back Cam" : "Use Front Cam"}
            </button>
          </>
        )}

        {cameraActive && (
          <button
            style={{ ...styles.btn, background: "#f3f4f6", color: "#374151" }}
            onClick={stopCamera}
          >
            ⏹ Stop Camera
          </button>
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
            <div style={styles.imageContainer}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  maxWidth: 720,
                  maxHeight: 480,
                  borderRadius: 12,
                  background: "#000",
                }}
              />
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
              Position faces clearly in the viewfinder and click <strong>Capture & Recognize</strong>.
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
                    return (
                      <g key={face.faceIndex}>
                        <rect
                          x={x1}
                          y={y1}
                          width={x2 - x1}
                          height={y2 - y1}
                          fill="none"
                          stroke={color}
                          strokeWidth={Math.max(3, result.imageWidth * 0.003)}
                        />
                        <text
                          x={x1}
                          y={y1 - 8}
                          fill={color}
                          fontSize={Math.max(18, result.imageWidth * 0.018)}
                          fontWeight="bold"
                        >
                          #{face.faceIndex} {face.status}
                        </text>
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
              Click <strong>Start Live Camera</strong> above to stream live video for face attendance recognition.
            </p>
          </div>
        )}

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
      {error && <div style={styles.error}>⚠️ {error}</div>}

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

                {/* Avatar */}
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    style={styles.candidateAvatar}
                  />
                ) : (
                  <div
                    style={{
                      ...styles.candidateAvatar,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#9ca3af",
                    }}
                  >
                    {c.name.charAt(0)}
                  </div>
                )}

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

      {isLive && face.candidates.length === 0 && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "#fef3c7",
            fontSize: 13,
            color: "#92400e",
          }}
        >
          ⚠️ No matching person found in database
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
