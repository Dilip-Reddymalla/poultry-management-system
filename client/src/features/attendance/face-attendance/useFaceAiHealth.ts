import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceAiHealthState } from "./face-attendance.types.js";

export function useFaceAiHealth() {
  const [faceAiStatus, setFaceAiStatus] = useState<FaceAiHealthState | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [faceAiWarmingUp, setFaceAiWarmingUp] = useState(false);
  const warmingUpPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [warmingUpCountdown, setWarmingUpCountdown] = useState(0);

  const stopWarmingUpPoll = useCallback(() => {
    if (warmingUpPollRef.current) {
      clearInterval(warmingUpPollRef.current);
      warmingUpPollRef.current = null;
    }
    setFaceAiWarmingUp(false);
    setWarmingUpCountdown(0);
  }, []);

  const checkFaceAiHealth = useCallback(
    async (triggerRestart = false) => {
      setCheckingHealth(true);
      try {
        if (triggerRestart) {
          try {
            await fetch("/api/face-ai/restart", { method: "POST" });
          } catch {
            // Ignore fire-and-forget error
          }
        }

        const res = await fetch("/api/face-ai/health");
        const data = await res.json().catch(() => null);
        const isOffline =
          data?.circuitBreaker?.state === "OPEN" ||
          data?.serviceStatus === "offline" ||
          data?.fallbackMode === "MANUAL_ATTENDANCE";

        if (isOffline) {
          setFaceAiStatus({
            online: false,
            circuitBreakerState: data?.circuitBreaker?.state ?? "OPEN",
            message: data?.message || "Face AI biometric service is unavailable.",
            fallbackMode: "MANUAL_ATTENDANCE",
          });

          if (!warmingUpPollRef.current) {
            setFaceAiWarmingUp(true);
            setWarmingUpCountdown(8);

            const countdownId = setInterval(() => {
              setWarmingUpCountdown((prev) => (prev <= 1 ? 8 : prev - 1));
            }, 1000);

            warmingUpPollRef.current = setInterval(async () => {
              try {
                const pollRes = await fetch("/api/face-ai/health");
                const pollData = await pollRes.json().catch(() => null);
                const stillOffline =
                  pollData?.circuitBreaker?.state === "OPEN" ||
                  pollData?.serviceStatus === "offline" ||
                  pollData?.fallbackMode === "MANUAL_ATTENDANCE";

                if (!stillOffline) {
                  clearInterval(countdownId);
                  stopWarmingUpPoll();
                  setFaceAiStatus({
                    online: true,
                    circuitBreakerState: pollData?.circuitBreaker?.state ?? "CLOSED",
                    fallbackMode: null,
                  });
                } else {
                  setWarmingUpCountdown(8);
                }
              } catch {
                // Keep polling
              }
            }, 8000);

            return () => clearInterval(countdownId);
          }
        } else {
          stopWarmingUpPoll();
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
    },
    [stopWarmingUpPoll],
  );

  useEffect(() => {
    void checkFaceAiHealth();
    return () => {
      stopWarmingUpPoll();
    };
  }, [checkFaceAiHealth, stopWarmingUpPoll]);

  return {
    faceAiStatus,
    setFaceAiStatus,
    checkingHealth,
    faceAiWarmingUp,
    warmingUpCountdown,
    checkFaceAiHealth,
    stopWarmingUpPoll,
  };
}
