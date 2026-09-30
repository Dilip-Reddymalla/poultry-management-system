import type React from "react";
import type { FrameProcessResult } from "../../../api/face-attendance.api.js";
import { styles } from "./face-attendance.styles.js";

interface FaceAttendanceFeedbackProps {
  result: FrameProcessResult | null;
  error: string | null;
  submitResult: { markedCount: number; duplicateCount: number } | null;
  onNavigateToManual: () => void;
}

export function FaceAttendanceFeedback({
  result,
  error,
  submitResult,
  onNavigateToManual,
}: FaceAttendanceFeedbackProps): React.ReactElement {
  const liveFaces = result?.faces.filter((f) => f.status === "LIVE") ?? [];

  return (
    <>
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
                onClick={onNavigateToManual}
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
            We could not detect any faces in this photo. Please capture a clearer, front-facing photo with adequate lighting and visible faces.
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
            The detected face(s) did not meet the sharpness or quality requirements. Please take a cleaner, well-lit image with personnel looking directly at the camera.
          </div>
        </div>
      )}
    </>
  );
}
