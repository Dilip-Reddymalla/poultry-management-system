import type React from "react";
import type { FrameProcessResult } from "../../../api/face-attendance.api.js";
import type { FaceSelection } from "./face-attendance.types.js";
import { styles, statusColor } from "./face-attendance.styles.js";

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

  return (
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
                // Mirror only front camera
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
                WebkitTransform: facingMode === "user" ? "scaleX(-1)" : "none",
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
              onClick={onCaptureFrame}
              title={!hasValidLocation ? "GPS location is required before taking attendance" : undefined}
            >
              {processing && <span style={styles.spinner} />}
              {processing ? "Analyzing Frame…" : "📸 Capture & Recognize"}
            </button>
            <button
              style={{ ...styles.btn, background: "#e0e7ff", color: "#3730a3" }}
              onClick={onToggleCamera}
              title="Switch between front and back camera"
            >
              🔄 {facingMode === "user" ? "Use Back Cam (16:9)" : "Use Front Cam (Portrait)"}
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
