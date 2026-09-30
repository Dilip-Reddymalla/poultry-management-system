import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import type { Farm, Shed, Shift } from "../../api/types.js";
import { apiClient } from "../../api/client.js";
import { fetchSheds } from "../../api/resources.js";
import { useAuth } from "../../auth/use-auth.js";
import {
  processFrame,
  bulkMarkFaceAttendance,
  type FrameProcessResult,
  type FaceAttendanceRecord,
} from "../../api/face-attendance.api.js";
import { validateShiftTiming } from "../../lib/shift-timing.js";

import type { FaceSelection } from "./face-attendance/face-attendance.types.js";
import { styles } from "./face-attendance/face-attendance.styles.js";
import { useFaceAttendanceGps } from "./face-attendance/useFaceAttendanceGps.js";
import { useFaceAiHealth } from "./face-attendance/useFaceAiHealth.js";
import { FaceAiHealthBanners } from "./face-attendance/FaceAiHealthBanners.js";
import { GpsGuidanceBanners } from "./face-attendance/GpsGuidanceBanners.js";
import { FaceAttendanceControls } from "./face-attendance/FaceAttendanceControls.js";
import { FaceViewfinder } from "./face-attendance/FaceViewfinder.js";
import { FaceAttendanceFeedback } from "./face-attendance/FaceAttendanceFeedback.js";
import { FaceCard } from "./face-attendance/FaceCard.js";

export function FaceAttendancePage(): React.ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Face AI Circuit Breaker & Health Hook
  const {
    faceAiStatus,
    setFaceAiStatus,
    checkingHealth,
    faceAiWarmingUp,
    warmingUpCountdown,
    checkFaceAiHealth,
  } = useFaceAiHealth();

  // GPS Location Hook
  const {
    location,
    locationStatus,
    hasValidLocation,
    deviceLocationOff,
    locationPermissionDenied,
    gpsTimedOut,
    isGpsLoading,
    isIOS,
    requestGpsLocation,
  } = useFaceAttendanceGps();

  // Farm & Shed Selection
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [farmsLoaded, setFarmsLoaded] = useState(false);

  const [sheds, setSheds] = useState<Shed[]>([]);
  const [selectedShedId, setSelectedShedId] = useState<string>("");

  // Shift Selection
  const [selectedShift, setSelectedShift] = useState<Shift>("MORNING_SHIFT");

  // Camera State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Image & Processing State
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<FrameProcessResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    markedCount: number;
    duplicateCount: number;
  } | null>(null);

  // Face Identity Selections
  const [selections, setSelections] = useState<FaceSelection[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Load farms once
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

  // 2. Load Sheds when Farm changes
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

  // 3. Camera cleanup & stream attachment
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

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, facingMode]);

  // 4. Start Camera
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
              : "Could not open camera: " +
                  (err.message || fallbackErr.message || lastErr.message || "Unknown error"),
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

  // 5. Frame capture & recognition
  const captureFrameAndProcess = async () => {
    if (!selectedFarmId) {
      setError("Please select a farm first.");
      return;
    }

    if (!hasValidLocation) {
      setError(
        "⛔ Attendance Blocked: Valid GPS location is mandatory to capture attendance. Please enable device GPS / allow location access.",
      );
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
        const targetRatio = 16 / 9;
        if (Math.abs(currentRatio - targetRatio) > 0.02) {
          if (currentRatio < targetRatio) {
            sWidth = vw;
            sHeight = Math.round(vw / targetRatio);
            sx = 0;
            sy = Math.round((vh - sHeight) / 2);
          } else {
            sHeight = vh;
            sWidth = Math.round(vh * targetRatio);
            sy = 0;
            sx = Math.round((vw - sWidth) / 2);
          }
        }
      } else {
        if (currentRatio > 1) {
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
        (errMsg.includes("Face AI service is unavailable") &&
          (err?.status === 503 || err?.status === 502)) ||
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
        if (
          errMsg.includes("decode") ||
          errMsg.includes("corrupt") ||
          errMsg.includes("format") ||
          errMsg.includes("Image processing") ||
          err?.status === 400 ||
          err?.status === 422
        ) {
          setError(
            "Unable to process this image. Please capture a clearer photo with good lighting.",
          );
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

    if (!hasValidLocation) {
      setError(
        "⛔ Attendance Blocked: Valid GPS location is mandatory to process attendance. Please enable device GPS / grant location access.",
      );
      e.target.value = "";
      return;
    }

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
        (errMsg.includes("Face AI service is unavailable") &&
          (err?.status === 503 || err?.status === 502)) ||
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
        if (
          errMsg.includes("decode") ||
          errMsg.includes("corrupt") ||
          errMsg.includes("format") ||
          errMsg.includes("Image processing") ||
          err?.status === 400 ||
          err?.status === 422
        ) {
          setError(
            "Unable to process this image. Please upload a clearer photo with good lighting.",
          );
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
          s.faceIndex === faceIndex ? { ...s, personId: candidateId, personType } : s,
        ),
      );
    },
    [],
  );

  const acRoomShed = sheds.find(
    (s) => s.number.toLowerCase() === "ac room" || s.number.toLowerCase().includes("ac room"),
  );

  const handleSubmitAttendance = useCallback(async () => {
    if (!result) return;

    if (!hasValidLocation || !location) {
      setError(
        "⛔ Attendance Blocked: Valid non-zero GPS location is strictly required to record attendance. Please enable device GPS / allow location access.",
      );
      return;
    }

    const timingValidation = validateShiftTiming(selectedShift);
    if (!timingValidation.allowed) {
      setError(
        timingValidation.message || "Attendance submission blocked due to shift timing restriction.",
      );
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const records: FaceAttendanceRecord[] = [];

    const lat = location.latitude;
    const lng = location.longitude;

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
  const shiftCheck = validateShiftTiming(selectedShift);

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎯 Live Face Attendance</h1>
        <p style={styles.subtitle}>
          Capture live camera faces, verify shift window & GPS location, and mark attendance
        </p>
      </div>

      {/* Face AI Circuit Breaker & Warm-up Banners */}
      <FaceAiHealthBanners
        faceAiStatus={faceAiStatus}
        faceAiWarmingUp={faceAiWarmingUp}
        warmingUpCountdown={warmingUpCountdown}
        checkingHealth={checkingHealth}
        onCheckHealth={checkFaceAiHealth}
        onSwitchToManual={() => navigate("/attendance")}
      />

      {/* Farm, Shed, Shift, Camera & GPS Status Controls */}
      <FaceAttendanceControls
        farms={farms}
        selectedFarmId={selectedFarmId}
        onSelectFarmId={setSelectedFarmId}
        sheds={sheds}
        selectedShedId={selectedShedId}
        onSelectShedId={setSelectedShedId}
        selectedShift={selectedShift}
        onSelectShift={setSelectedShift}
        facingMode={facingMode}
        onChangeFacingMode={(mode) => {
          setFacingMode(mode);
          if (cameraActive) {
            startCamera(mode);
          }
        }}
        locationStatus={locationStatus}
        hasValidLocation={hasValidLocation}
        isGpsLoading={isGpsLoading}
        onRequestGpsLocation={requestGpsLocation}
      />

      {/* Guidance Banners when Location is Blocked or Unavailable */}
      <GpsGuidanceBanners
        deviceLocationOff={deviceLocationOff}
        locationPermissionDenied={locationPermissionDenied}
        gpsTimedOut={gpsTimedOut}
        hasValidLocation={hasValidLocation}
        isIOS={isIOS}
        isGpsLoading={isGpsLoading}
        onRequestGpsLocation={requestGpsLocation}
      />

      {/* Camera Feed, Bounding Box Viewfinder & Capture Controls */}
      <FaceViewfinder
        cameraActive={cameraActive}
        facingMode={facingMode}
        cameraError={cameraError}
        videoRef={videoRef}
        fileInputRef={fileInputRef}
        imagePreviewUrl={imagePreviewUrl}
        result={result}
        selections={selections}
        processing={processing}
        submitting={submitting}
        selectedFarmId={selectedFarmId}
        hasValidLocation={hasValidLocation}
        shiftAllowed={shiftCheck.allowed}
        confirmedCount={confirmedCount}
        onStartCamera={startCamera}
        onStopCamera={stopCamera}
        onToggleCamera={toggleCamera}
        onCaptureFrame={captureFrameAndProcess}
        onFileSelect={handleFileSelect}
        onSubmitAttendance={handleSubmitAttendance}
      />

      {/* Processing Statistics & Feedback Alerts */}
      <FaceAttendanceFeedback
        result={result}
        error={error}
        submitResult={submitResult}
        onNavigateToManual={() => navigate("/attendance")}
      />

      {/* Detected Faces Grid & Candidate Matching Cards */}
      {result && result.faces.length > 0 && (
        <div style={styles.facesGrid}>
          {result.faces.map((face) => (
            <FaceCard
              key={face.faceIndex}
              face={face}
              selection={selections.find((s) => s.faceIndex === face.faceIndex)}
              onSelect={handleSelectionChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
