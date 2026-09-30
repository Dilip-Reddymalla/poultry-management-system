import type React from "react";
import type { FaceAiHealthState } from "./face-attendance.types.js";

interface FaceAiHealthBannersProps {
  faceAiStatus: FaceAiHealthState | null;
  faceAiWarmingUp: boolean;
  warmingUpCountdown: number;
  checkingHealth: boolean;
  onCheckHealth: (triggerRestart?: boolean) => void;
  onSwitchToManual: () => void;
}

export function FaceAiHealthBanners({
  faceAiStatus,
  faceAiWarmingUp,
  warmingUpCountdown,
  checkingHealth,
  onCheckHealth,
  onSwitchToManual,
}: FaceAiHealthBannersProps): React.ReactElement | null {
  // 1. Server Warming-Up Banner
  if (faceAiWarmingUp && faceAiStatus?.fallbackMode === "MANUAL_ATTENDANCE") {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)",
          border: "1px solid #3b82f6",
          borderRadius: 12,
          padding: "18px 22px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14,
          boxShadow: "0 4px 16px rgba(59, 130, 246, 0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 260 }}>
          <span
            style={{
              display: "inline-block",
              width: 32,
              height: 32,
              border: "3px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 15, marginBottom: 3 }}>
              🤖 AI Server is Starting Up — Please Wait
            </div>
            <div style={{ color: "#bfdbfe", fontSize: 13, lineHeight: 1.5 }}>
              The face recognition engine is warming up. This usually takes <strong style={{ color: "#fff" }}>15–30 seconds</strong>.
              Checking again in <strong style={{ color: "#fbbf24" }}>{warmingUpCountdown}s</strong>…
              Do not refresh the page.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 8,
              padding: "10px 18px",
              fontWeight: 600,
              fontSize: 13,
              cursor: checkingHealth ? "not-allowed" : "pointer",
              backdropFilter: "blur(4px)",
            }}
            disabled={checkingHealth}
            onClick={() => onCheckHealth(true)}
          >
            {checkingHealth ? "⏳ Checking…" : "🔄 Check Now"}
          </button>
          <button
            type="button"
            style={{
              background: "#d97706",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
            onClick={onSwitchToManual}
          >
            📋 Manual Attendance
          </button>
        </div>
      </div>
    );
  }

  // 2. Circuit Breaker Fail-Open Alert Banner
  if (!faceAiWarmingUp && faceAiStatus?.fallbackMode === "MANUAL_ATTENDANCE") {
    return (
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
            onClick={onSwitchToManual}
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
            onClick={() => onCheckHealth(true)}
          >
            {checkingHealth ? "⏳ Restarting…" : "🔄 Restart & Retry"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
