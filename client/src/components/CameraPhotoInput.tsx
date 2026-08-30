import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui.js";

interface CameraPhotoInputProps {
  label?: string;
  currentPhotoUrl?: string | null;
  onChange: (file: File | null) => void;
}

export function CameraPhotoInput({
  label = "Photo & Face ID",
  currentPhotoUrl,
  onChange,
}: CameraPhotoInputProps): React.ReactElement {
  const [mode, setMode] = useState<"idle" | "camera">("idle");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentPhotoUrl ?? null,
  );
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera stream helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Clean up stream on unmount
  // Attach stream to video element once mode becomes camera
  useEffect(() => {
    if (mode === "camera" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [mode]);

  const startCamera = async (targetFacingMode?: "user" | "environment") => {
    setCameraError(null);
    const modeToUse = targetFacingMode || facingMode;
    if (targetFacingMode && targetFacingMode !== facingMode) {
      setFacingMode(targetFacingMode);
    }
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: modeToUse },
      });
      streamRef.current = stream;
      setMode("camera");
    } catch (err: any) {
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permissions."
          : "Unable to access camera: " + (err.message || "Unknown error"),
      );
      stopCamera();
    }
  };

  const toggleCamera = async () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    await startCamera(nextFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "face_capture.jpg", {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        onChange(file);
        stopCamera();
        setMode("idle");
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onChange(file);
    }
  };

  const handleClear = () => {
    setPreviewUrl(null);
    onChange(null);
    stopCamera();
    setMode("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="field" style={{ marginBottom: "1rem" }}>
      <label className="field__label">{label}</label>

      {/* Camera Live Feed */}
      {mode === "camera" && (
        <div
          style={{
            position: "relative",
            background: "#000",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: 8,
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              maxWidth: 360,
              maxHeight: 280,
              borderRadius: 6,
              objectFit: "cover",
            }}
          />
          {cameraError && (
            <div
              style={{
                color: "#ef4444",
                fontSize: 13,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              {cameraError}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Button
              type="button"
              variant="primary"
              onClick={capturePhoto}
              disabled={!!cameraError}
            >
              📸 Capture Live Photo
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={toggleCamera}
            >
              🔄 {facingMode === "user" ? "Use Back Cam" : "Use Front Cam"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                stopCamera();
                setMode("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Preview or Empty State */}
      {mode === "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {previewUrl ? (
            <div style={{ position: "relative" }}>
              <img
                src={previewUrl}
                alt="Face Preview"
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid var(--primary, #6366f1)",
                }}
              />
              <button
                type="button"
                onClick={handleClear}
                title="Remove photo"
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: "50%",
                background: "var(--surface-secondary, #f3f4f6)",
                border: "2px dashed #d1d5db",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                color: "#9ca3af",
              }}
            >
              👤
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button type="button" variant="secondary" onClick={() => startCamera("user")}>
                📷 Front Cam
              </Button>
              <Button type="button" variant="secondary" onClick={() => startCamera("environment")}>
                📷 Back Cam
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
              >
                📁 Upload File
              </Button>
            </div>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Photo is automatically validated for face quality and liveness.
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  );
}
