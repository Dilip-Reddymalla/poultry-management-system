import { useEffect, useState, useRef } from "react";
import type React from "react";

/* ─── Phase thresholds (ms) ─────────────────────────────────────────────── */
const PHASE_EXTENDED  = 1500;   // show rotating messages + progress
const PHASE_SLOW      = 5000;   // amber "slow connection" banner
const PHASE_VERY_SLOW = 10000;  // red warning + retry hint

/* ─── Status messages for the extended phase ────────────────────────────── */
const STEP_MESSAGES = [
  { icon: "🔍", text: "Detecting faces…" },
  { icon: "🧠", text: "Matching identities…" },
  { icon: "📊", text: "Scoring confidence…" },
];

/* ─── Mobile detection helper ───────────────────────────────────────────── */
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FaceProcessingOverlay — adaptive, phase-based processing feedback
   ═══════════════════════════════════════════════════════════════════════════ */

interface FaceProcessingOverlayProps {
  visible: boolean;
}

export function FaceProcessingOverlay({
  visible,
}: FaceProcessingOverlayProps): React.ReactElement | null {
  const [elapsed, setElapsed] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const startRef = useRef<number>(0);
  const mobile = useIsMobile();

  // Elapsed-time counter (updates every 200 ms)
  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      setStepIdx(0);
      startRef.current = 0;
      return;
    }
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 200);
    return () => clearInterval(id);
  }, [visible]);

  // Rotate step messages every 1.6 s (only in extended phase)
  useEffect(() => {
    if (!visible || elapsed < PHASE_EXTENDED) return;
    const id = setInterval(() => {
      setStepIdx((i) => (i + 1) % STEP_MESSAGES.length);
    }, 1600);
    return () => clearInterval(id);
  }, [visible, elapsed >= PHASE_EXTENDED]);

  if (!visible) return null;

  const inExtended  = elapsed >= PHASE_EXTENDED;
  const inSlow      = elapsed >= PHASE_SLOW;
  const inVerySlow  = elapsed >= PHASE_VERY_SLOW;

  const step = STEP_MESSAGES[stepIdx]!;

  // Progress: fast ramp 0→60 in first 1.5s, slow 60→85 up to 5s, crawl after
  let progress: number;
  if (elapsed < PHASE_EXTENDED) {
    progress = Math.min(60, (elapsed / PHASE_EXTENDED) * 60);
  } else if (elapsed < PHASE_SLOW) {
    progress = 60 + ((elapsed - PHASE_EXTENDED) / (PHASE_SLOW - PHASE_EXTENDED)) * 25;
  } else {
    progress = Math.min(95, 85 + ((elapsed - PHASE_SLOW) / 20000) * 10);
  }

  /* ── Responsive sizing ─────────────────────────────────────────────── */
  const ringSize    = mobile ? 54 : 72;
  const spinnerSize = mobile ? 14 : 16;
  const badgePad    = mobile ? "6px 12px" : "8px 18px";
  const badgeGap    = mobile ? 6 : 8;
  const iconSize    = mobile ? 13 : 15;
  const labelSize   = mobile ? 11 : 13;
  const dotSize     = mobile ? 3 : 4;
  const barWidth    = mobile ? 120 : 160;
  const warnPad     = mobile ? "6px 10px" : "8px 14px";
  const warnGap     = mobile ? 6 : 8;
  const warnIcon    = mobile ? 14 : 16;
  const warnText    = mobile ? 11 : 12;
  const warnSubText = mobile ? 10 : 11;
  const warnInset   = mobile ? 8 : 12;

  return (
    <>
      {/* ─── Keyframe animations ──────────────────────────────────────────── */}
      <style>{`
        @keyframes fpo-pulse-ring {
          0%   { transform: translate(-50%,-50%) scale(0.92); opacity: 0.7; }
          50%  { transform: translate(-50%,-50%) scale(1.06); opacity: 1;   }
          100% { transform: translate(-50%,-50%) scale(0.92); opacity: 0.7; }
        }
        @keyframes fpo-shimmer {
          0%   { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(220%)  skewX(-15deg); }
        }
        @keyframes fpo-badge-enter {
          from { opacity: 0; transform: translateY(5px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes fpo-dot-pulse {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        @keyframes fpo-glow {
          0%, 100% { box-shadow: 0 0 6px rgba(99,102,241,0.5); }
          50%      { box-shadow: 0 0 16px rgba(99,102,241,0.8), 0 0 30px rgba(99,102,241,0.3); }
        }
        @keyframes fpo-scan {
          0%   { top: 0%; }
          100% { top: 100%; }
        }
        @keyframes fpo-warn-enter {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      {/* ─── Overlay container ───────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 8,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {/* 1. Subtle dark tint */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: inSlow
              ? "rgba(15, 23, 42, 0.55)"
              : "rgba(15, 23, 42, 0.35)",
            transition: "background 0.4s ease",
          }}
        />

        {/* 2. Shimmer wave — only in extended phase */}
        {inExtended && (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "50%",
                height: "100%",
                background:
                  "linear-gradient(105deg, transparent 30%, rgba(99,102,241,0.18) 50%, rgba(139,92,246,0.14) 55%, transparent 70%)",
                animation: "fpo-shimmer 2.4s ease-in-out infinite",
              }}
            />
          </div>
        )}

        {/* 3. Scan line — only in slow phase */}
        {inSlow && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 2,
              background:
                "linear-gradient(90deg, transparent, #fbbf24 25%, #f59e0b 50%, #fbbf24 75%, transparent)",
              boxShadow: "0 0 8px #fbbf24, 0 0 16px #f59e0b60",
              animation: "fpo-scan 2s linear infinite",
            }}
          />
        )}

        {/* ── Phase 1 (0–1.5s): Minimal pulse + "Analyzing…" ──────────── */}
        {!inExtended && (
          <>
            {/* Pulsing ring */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: ringSize,
                height: ringSize,
                borderRadius: "50%",
                border: "2.5px solid rgba(99,102,241,0.7)",
                animation: "fpo-pulse-ring 1.2s ease-in-out infinite",
              }}
            />

            {/* Simple badge */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                gap: mobile ? 5 : 7,
                background: "rgba(15, 23, 42, 0.8)",
                backdropFilter: "blur(8px)",
                borderRadius: 999,
                padding: mobile ? "6px 12px" : "7px 16px",
                border: "1px solid rgba(99,102,241,0.45)",
                animation: "fpo-badge-enter 0.25s ease forwards",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: spinnerSize,
                  height: spinnerSize,
                  border: "2px solid #a5b4fc",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }}
              />
              <span style={{ color: "#e0e7ff", fontSize: mobile ? 11 : 13, fontWeight: 600 }}>
                Analyzing…
              </span>
            </div>
          </>
        )}

        {/* ── Phase 2 (1.5s+): Rotating messages + progress bar ───────── */}
        {inExtended && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: mobile ? 7 : 10,
              animation: "fpo-badge-enter 0.3s ease forwards",
              maxWidth: "90%",
            }}
          >
            {/* Status pill */}
            <div
              key={stepIdx}
              style={{
                background: "rgba(15, 23, 42, 0.82)",
                backdropFilter: "blur(10px)",
                border: `1px solid ${inSlow ? "rgba(251,191,36,0.5)" : "rgba(99,102,241,0.5)"}`,
                borderRadius: 999,
                padding: badgePad,
                display: "flex",
                alignItems: "center",
                gap: badgeGap,
                boxShadow: inSlow
                  ? "0 4px 18px rgba(251,191,36,0.2)"
                  : "0 4px 18px rgba(99,102,241,0.25)",
                animation: "fpo-badge-enter 0.3s ease forwards",
                transition: "border-color 0.3s, box-shadow 0.3s",
              }}
            >
              <span style={{ fontSize: iconSize }}>{step.icon}</span>
              <span
                style={{
                  color: "#e0e7ff",
                  fontSize: labelSize,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                {step.text}
              </span>
              <span style={{ display: "flex", gap: 3, marginLeft: 2 }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      width: dotSize,
                      height: dotSize,
                      borderRadius: "50%",
                      background: inSlow ? "#fbbf24" : "#818cf8",
                      animation: `fpo-dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </span>
            </div>

            {/* Progress bar */}
            <div
              style={{
                width: barWidth,
                height: 3,
                borderRadius: 999,
                background: "rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  borderRadius: 999,
                  background: inSlow
                    ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                    : "linear-gradient(90deg, #6366f1, #a78bfa, #38bdf8)",
                  transition: "width 0.2s linear, background 0.4s ease",
                  animation: "fpo-glow 1.5s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        )}

        {/* ── Phase 3 (5s+): Slow connection amber warning ────────────── */}
        {inSlow && !inVerySlow && (
          <div
            style={{
              position: "absolute",
              bottom: warnInset,
              left: warnInset,
              right: warnInset,
              background: "rgba(120, 53, 15, 0.88)",
              backdropFilter: "blur(6px)",
              borderRadius: mobile ? 6 : 8,
              padding: warnPad,
              display: "flex",
              alignItems: "center",
              gap: warnGap,
              animation: "fpo-warn-enter 0.35s ease forwards",
              border: "1px solid rgba(251,191,36,0.4)",
            }}
          >
            <span style={{ fontSize: warnIcon, flexShrink: 0 }}>🐢</span>
            <span style={{ color: "#fef3c7", fontSize: warnText, fontWeight: 600, lineHeight: 1.3 }}>
              {mobile
                ? "Slow connection. Still working…"
                : "Taking longer than usual — possible slow connection. Still working…"}
            </span>
          </div>
        )}

        {/* ── Phase 4 (10s+): Very slow — red warning ─────────────────── */}
        {inVerySlow && (
          <div
            style={{
              position: "absolute",
              bottom: warnInset,
              left: warnInset,
              right: warnInset,
              background: "rgba(127, 29, 29, 0.9)",
              backdropFilter: "blur(6px)",
              borderRadius: mobile ? 6 : 8,
              padding: warnPad,
              display: "flex",
              alignItems: "center",
              gap: warnGap,
              animation: "fpo-warn-enter 0.35s ease forwards",
              border: "1px solid rgba(239,68,68,0.5)",
            }}
          >
            <span style={{ fontSize: warnIcon, flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: "#fecaca", fontSize: warnText, fontWeight: 600, display: "block", lineHeight: 1.3 }}>
                {mobile
                  ? "Very slow — still trying…"
                  : "Very slow connection — still trying…"}
              </span>
              <span style={{ color: "#fca5a5", fontSize: warnSubText, fontWeight: 500, lineHeight: 1.3 }}>
                Check your internet and retry.
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Camera Shutter Flash — brief white flash on capture for tactile feedback
   ═══════════════════════════════════════════════════════════════════════════ */

interface ShutterFlashProps {
  trigger: boolean;
}

export function ShutterFlash({ trigger }: ShutterFlashProps): React.ReactElement | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger) {
      setShow(true);
      const id = setTimeout(() => setShow(false), 180);
      return () => clearTimeout(id);
    }
  }, [trigger]);

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes fpo-shutter {
          0%   { opacity: 0.85; }
          100% { opacity: 0; }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#fff",
          borderRadius: 12,
          zIndex: 20,
          animation: "fpo-shutter 0.18s ease-out forwards",
          pointerEvents: "none",
        }}
      />
    </>
  );
}
