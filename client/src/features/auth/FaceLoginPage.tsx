import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { signInWithFace } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { useAuth } from "../../auth/use-auth.js";
import { EggIcon } from "../../components/icons.js";
import { Button, FormAlert } from "../../components/ui.js";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher.js";
import { OfflineNotice } from "../../pwa/OfflineNotice.js";
import { AuthMethodTabs } from "./AuthMethodTabs.js";
import "./AuthPages.css";

interface LocationState {
  from?: string;
}

export function FaceLoginPage(): React.ReactElement {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(
    async (mode: "user" | "environment") => {
      stopCamera();
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 720 }, height: { ideal: 960 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch {
        setCameraError("Camera access is required for Face Unlock.");
      }
    },
    [stopCamera],
  );

  useEffect(() => {
    void startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [facingMode, startCamera, stopCamera]);

  async function handleUnlock(): Promise<void> {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    setBusy(true);
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Failed to capture photo");

      const file = new File([blob], "face-unlock.jpg", { type: "image/jpeg" });
      const data = await signInWithFace(file);

      stopCamera();
      setSession(data.user);
      const state = location.state as LocationState | null;
      navigate(state?.from ?? "/dashboard", { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, t("error.somethingWentWrong")),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin signin--single">
      <main className="signin__main">
        <div className="signin__form">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div className="signin__brand signin__brand--dark" style={{ margin: 0 }}>
              <EggIcon className="signin__mark" />
              <span>
                Poultry<strong>Ops</strong>
              </span>
            </div>
            <LanguageSwitcher />
          </div>

          <h1 className="signin__title">📷 {t("auth.faceLogin.title", { defaultValue: "Face Unlock" })}</h1>

          <OfflineNotice />
          <AuthMethodTabs />
          <FormAlert error={error} />
          {cameraError ? (
            <div className="alert alert--error" role="alert">
              <span>⚠️ {cameraError}</span>
            </div>
          ) : null}

          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 320,
              margin: "0 auto",
              borderRadius: 16,
              overflow: "hidden",
              background: "#0f172a",
              aspectRatio: "3 / 4",
              border: "2px solid var(--line-strong)",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
              }}
            />
            <button
              type="button"
              onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
              title="Switch camera"
              aria-label="Switch camera"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                background: "rgba(15, 23, 42, 0.75)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 999,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              🔄
            </button>
          </div>

          <Button
            type="button"
            variant="success"
            busy={busy}
            disabled={!cameraReady || busy}
            onClick={() => {
              void handleUnlock();
            }}
            style={{ width: "100%", minHeight: 52, fontSize: "1.05rem" }}
          >
            📸 {t("auth.faceLogin.unlockButton", { defaultValue: "Unlock with Face" })}
          </Button>
        </div>
      </main>
    </div>
  );
}
