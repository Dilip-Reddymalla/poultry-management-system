import type React from "react";
import { useState } from "react";
import type { FrameProcessResult } from "../../../api/face-attendance.api.js";
import type { FaceSelection } from "./face-attendance.types.js";
import { styles, statusColor } from "./face-attendance.styles.js";
import { FaceProcessingOverlay, ShutterFlash, useIsMobile } from "./FaceProcessingOverlay.js";

interface FaceViewfinderProps {
  cameraActive: boolean;
  facingMode: "user" | "environment";
  cameraError: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imagePreviewUrl: string | null;
  result: FrameProcessResult | null;
  selections: FaceSelection[];
  processing: boolean;
  submitting: boolean;
  selectedFarmId: string;
  hasValidLocation: boolean;
  shiftAllowed: boolean;
  confirmedCount: number;
  onStartCamera: (facing?: "user" | "environment") => void;
  onStopCamera: () => void;
  onToggleCamera: () => void;
  onCaptureFrame: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitAttendance: () => void;
}

export function FaceViewfinder({
  cameraActive,
  facingMode,
  cameraError,
  videoRef,
  fileInputRef,
  imagePreviewUrl,
  result,
  selections,
  processing,
  submitting,
  selectedFarmId,
  hasValidLocation,
  shiftAllowed,
  confirmedCount,
  onStartCamera,
  onStopCamera,
  onToggleCamera,
  onCaptureFrame,
  onFileSelect,
  onSubmitAttendance,
}: FaceViewfinderProps): React.ReactElement {
  const liveFaces = result?.faces.filter((f) => f.status === "LIVE") ?? [];
  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Track shutter flash trigger — fires once when capture is clicked
  const [shutterFired, setShutterFired] = useState(false);

  const handleCapture = () => {
    setShutterFired(true);
    onCaptureFrame();
    if (isFullscreen) {
      setTimeout(() => setIsFullscreen(false), 250);
    }
    setTimeout(() => setShutterFired(false), 300);
  };

  return (
    <div style={styles.card}>
      {cameraError && <div style={styles.error}>⚠️ {cameraError}</div>}

      {cameraActive && (
        <div
          style={
            isFullscreen
              ? {
                  position: "fixed",
                  inset: 0,
                  width: "100vw",
                  height: "100dvh",
                  zIndex: 99999,
                  background: "#030712",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "max(env(safe-area-inset-top), 12px) 12px max(env(safe-area-inset-bottom), 16px) 12px",
                  boxSizing: "border-box",
                }
              : { textAlign: "center" }
          }
        >
          {/* Top Bar when in Fullscreen Mode */}
          {isFullscreen && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "rgba(15, 23, 42, 0.8)",
                backdropFilter: "blur(8px)",
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#fff",
                marginBottom: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "none",
                  color: "#fff",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ✕ <span>Exit Fullscreen</span>
              </button>

              <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e7ff", textAlign: "center" }}>
                {facingMode === "environment" ? "📸 Back Camera (Group View)" : "📷 Front Camera (Selfie)"}
              </div>

              <button
                type="button"
                onClick={onToggleCamera}
                style={{
                  background: "rgba(99, 102, 241, 0.3)",
                  border: "1px solid rgba(165, 180, 252, 0.4)",
                  color: "#e0e7ff",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                🔄 <span>Switch</span>
              </button>
            </div>
          )}

          {/* Video Container (Shared instance - zero stream reloading) */}
          <div
            style={
              isFullscreen
                ? {
                    position: "relative",
                    flex: 1,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    borderRadius: 16,
                  }
                : {
                    ...styles.imageContainer,
                    width: "100%",
                    maxWidth: facingMode === "environment" ? 920 : 420,
                  }
            }
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={
                isFullscreen
                  ? {
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: 16,
                      background: "#000",
                      transform: facingMode === "user" ? "scaleX(-1)" : "none",
                      WebkitTransform: facingMode === "user" ? "scaleX(-1)" : "none",
                    }
                  : {
                      width: "100%",
                      maxWidth: facingMode === "environment" ? 920 : 420,
                      aspectRatio: facingMode === "environment" ? (isMobile ? "4 / 3" : "16 / 9") : "3 / 4",
                      objectFit: "cover",
                      borderRadius: 12,
                      background: "#000",
                      display: "block",
                      margin: "0 auto",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
                      transform: facingMode === "user" ? "scaleX(-1)" : "none",
                      WebkitTransform: facingMode === "user" ? "scaleX(-1)" : "none",
                    }
              }
            />

            {/* In inline mode: Floating 'Fullscreen Camera' button on top-right of preview */}
            {!isFullscreen && (
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  zIndex: 12,
                  background: "rgba(15, 23, 42, 0.8)",
                  backdropFilter: "blur(6px)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
                }}
                title="Expand camera to full mobile screen (Ideal for group attendance)"
              >
                <span>⛶</span> Fullscreen
              </button>
            )}

            {/* In fullscreen mode: Group alignment guide watermark */}
            {isFullscreen && (
              <div
                style={{
                  position: "absolute",
                  bottom: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0, 0, 0, 0.65)",
                  backdropFilter: "blur(6px)",
                  padding: "6px 16px",
                  borderRadius: 999,
                  color: "#f3f4f6",
                  fontSize: 13,
                  fontWeight: 500,
                  pointerEvents: "none",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                👥 Position workers across frame
              </div>
            )}

            {/* Camera shutter flash effect */}
            <ShutterFlash trigger={shutterFired} />
          </div>

          {/* Fullscreen Bottom Shutter Bar */}
          {isFullscreen && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                alignItems: "center",
                padding: "16px 8px 8px 8px",
              }}
            >
              <button
                type="button"
                onClick={() => onStopCamera()}
                style={{
                  background: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#fca5a5",
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ⏹ Stop
              </button>

              {/* Shutter Capture Button */}
              <button
                type="button"
                onClick={handleCapture}
                disabled={processing || !selectedFarmId || !hasValidLocation}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  border: "4px solid #ffffff",
                  background: processing || !selectedFarmId || !hasValidLocation ? "#6b7280" : "#4f46e5",
                  boxShadow: "0 0 20px rgba(99, 102, 241, 0.6)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  cursor: "pointer",
                  transition: "transform 0.15s ease",
                }}
              >
                <span style={{ fontSize: 24 }}>📸</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#ffffff",
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ✕ Close
              </button>
            </div>
          )}

          {!isFullscreen && (
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
              {facingMode === "environment"
                ? "📸 Back Camera (Tap Fullscreen for Group Photo) — Position workers across the frame"
                : "📷 Front Camera (Portrait) — Position face clearly inside the frame"}
              {" and click "}
              <strong>Capture & Recognize</strong>.
            </p>
          )}
        </div>
      )}

      {!cameraActive && imagePreviewUrl && (
        <div style={{ textAlign: "center" }}>
          <div style={styles.imageContainer}>
            <img
              src={imagePreviewUrl}
              alt="Captured frame"
              style={{
                ...styles.previewImage,
                // Slight blur while processing to emphasise the overlay
                filter: processing ? "blur(1.5px) brightness(0.88)" : "none",
                transition: "filter 0.3s ease",
              }}
            />

            {/* ── Adaptive processing overlay ── */}
            <FaceProcessingOverlay visible={processing} />

            {/* Bounding box overlay (only when result is available) */}
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
                  const badgeHeight = 46 * scale;
                  const avatarSize = 34 * scale;
                  const fontSizeName = 14 * scale;
                  const fontSizeSub = 11 * scale;
                  const padding = 6 * scale;

                  // Center the badge horizontally relative to the face bounding box
                  const faceCenterX = (x1 + x2) / 2;
                  const maxAllowedBadgeWidth = Math.max(120, result.imageWidth - 16);
                  const desiredBadgeWidth = Math.max(x2 - x1 + 20 * scale, 210 * scale);
                  const badgeWidth = Math.min(maxAllowedBadgeWidth, desiredBadgeWidth);

                  // Keep badge strictly within camera frame bounds horizontally
                  const badgeX = Math.max(8, Math.min(faceCenterX - badgeWidth / 2, result.imageWidth - badgeWidth - 8));

                  // Position above face if space permits; otherwise flip below face
                  const badgeY =
                    y1 - badgeHeight - 8 < 4
                      ? Math.min(result.imageHeight - badgeHeight - 8, y2 + 8)
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

                      {/* Floating Identity Badge (Centered on face box, clamped inside camera) */}
                      <g>
                        <defs>
                          <clipPath id={`avatar-clip-${face.faceIndex}`}>
                            <circle
                              cx={badgeX + padding + avatarSize / 2}
                              cy={badgeY + badgeHeight / 2}
                              r={avatarSize / 2}
                            />
                          </clipPath>
                          <clipPath id={`badge-clip-${face.faceIndex}`}>
                            <rect
                              x={badgeX}
                              y={badgeY}
                              width={badgeWidth}
                              height={badgeHeight}
                              rx={8 * scale}
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

                        {/* Contents clipped strictly to badge boundary */}
                        <g clipPath={`url(#badge-clip-${face.faceIndex})`}>
                          {matched ? (
                            <>
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
                                {matched.name.length > 18 ? `${matched.name.slice(0, 16)}…` : matched.name}
                              </text>

                              {/* Match percentage & role */}
                              <text
                                x={badgeX + padding + avatarSize + 8 * scale}
                                y={badgeY + padding + fontSizeName + fontSizeSub + 3 * scale}
                                fill={matched.similarity >= 0.6 ? "#34d399" : "#fbbf24"}
                                fontSize={fontSizeSub}
                                fontWeight="600"
                              >
                                {Math.round(matched.similarity * 100)}% Match • {matched.personType}
                              </text>
                            </>
                          ) : (
                            <text
                              x={badgeX + 10 * scale}
                              y={badgeY + badgeHeight / 2 + 5 * scale}
                              fill={color}
                              fontSize={fontSizeName * 0.95}
                              fontWeight="bold"
                            >
                              Face #{face.faceIndex} — {face.status === "LIVE" ? "Unrecognized" : face.status}
                            </text>
                          )}
                        </g>
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
            Select a farm and start the live camera to begin face recognition.
          </p>
        </div>
      )}

      {/* Camera & Capture Action Buttons */}
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
            onClick={() => onStartCamera()}
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
                ...(processing || !selectedFarmId || !hasValidLocation ? styles.btnDisabled : {}),
              }}
              disabled={processing || !selectedFarmId || !hasValidLocation}
              onClick={handleCapture}
              title={!hasValidLocation ? "GPS location is required before taking attendance" : undefined}
            >
              {processing && <span style={styles.spinner} />}
              {processing ? "Analyzing Frame…" : "📸 Capture & Recognize"}
            </button>
            <button
              style={{ ...styles.btn, background: "#1e1b4b", color: "#c7d2fe", border: "1px solid #4338ca" }}
              onClick={() => setIsFullscreen(true)}
              title="Expand viewfinder to full mobile screen (great for group photos)"
            >
              ⛶ Expand Fullscreen
            </button>
            <button
              style={{ ...styles.btn, background: "#e0e7ff", color: "#3730a3" }}
              onClick={onToggleCamera}
              title="Switch between front and back camera"
            >
              🔄 {facingMode === "user" ? "Use Back Cam" : "Use Front Cam"}
            </button>
            <button
              style={{ ...styles.btn, background: "#fee2e2", color: "#991b1b" }}
              onClick={onStopCamera}
            >
              ⏹ Stop Camera
            </button>
          </>
        )}

        <button
          style={{
            ...styles.btn,
            background: "#f3f4f6",
            color: "#9ca3af",
            border: "1px dashed #d1d5db",
            ...styles.btnDisabled,
            cursor: "not-allowed",
          }}
          disabled={true}
          title="Image upload is disabled for attendance. Live camera capture is required to verify real-time presence."
        >
          📁 Upload Image (Disabled for Attendance)
        </button>

        {result && liveFaces.length > 0 && (
          <button
            style={{
              ...styles.btn,
              ...styles.btnSuccess,
              fontSize: 16,
              padding: "12px 28px",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
              ...(submitting || confirmedCount === 0 || !shiftAllowed || !hasValidLocation
                ? styles.btnDisabled
                : {}),
            }}
            disabled={submitting || confirmedCount === 0 || !shiftAllowed || !hasValidLocation}
            onClick={onSubmitAttendance}
          >
            {submitting && <span style={styles.spinner} />}
            ✅ Mark Attendance ({confirmedCount})
          </button>
        )}

        {!hasValidLocation && (
          <div
            style={{
              width: "100%",
              marginTop: 10,
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              color: "#991b1b",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            ⛔ Attendance Blocked: Valid GPS Location access is strictly required. Please turn ON your device GPS / grant location permission and tap Refresh GPS.
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={onFileSelect}
      />
    </div>
  );
}
