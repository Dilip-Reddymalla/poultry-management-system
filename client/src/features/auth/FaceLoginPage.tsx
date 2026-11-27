import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { selectFaceAccount, signInWithFace } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import type { FaceAccount } from "../../api/types.js";
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

type Step =
  | { name: "camera" }
  | { name: "select"; selectionToken: string; accounts: FaceAccount[] };

export function FaceLoginPage(): React.ReactElement {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Each startCamera() bumps this id. When a pending getUserMedia() resolves, if
  // its id no longer matches, that stream belongs to a cancelled/cleared start
  // and is stopped right away instead of being leaked (camera kept on).
  const requestIdRef = useRef(0);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [step, setStep] = useState<Step>({ name: "camera" });

  const stopCamera = useCallback(() => {
    requestIdRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setCameraError(null);
  }, []);

  const startCamera = useCallback(
    async (mode: "user" | "environment") => {
      // stopCamera() bumps the generation id, so capture the id AFTER it so a
      // freshly requested stream is not treated as stale.
      stopCamera();
      const reqId = requestIdRef.current;
      setCameraError(null);

      // Ask for permission first. getUserMedia() is what triggers the browser
      // prompt, but if the permission is already blocked we can avoid a failed
      // stream request and instead tell the user exactly what to do.
      try {
        const status = await navigator.permissions.query({ name: "camera" });
        if (status.state === "denied") {
          setCameraError(t("auth.faceLogin.cameraDenied"));
          return;
        }
      } catch {
        // Permissions API unsupported/absent -> fall through to getUserMedia().
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 720 }, height: { ideal: 960 } },
        });
        // Superseded by a newer start/unmount before we could attach it.
        if (reqId !== requestIdRef.current) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch {
        if (reqId === requestIdRef.current) {
          setCameraError(t("auth.faceLogin.cameraDenied"));
        }
      }
    },
    [stopCamera, t],
  );

  useEffect(() => {
    if (step.name !== "camera") return;
    void startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [facingMode, step.name, startCamera, stopCamera]);

  function toApiError(caught: unknown): ApiError {
    return caught instanceof ApiError
      ? caught
      : new ApiError(0, t("error.somethingWentWrong"));
  }

  async function handleUnlock(): Promise<void> {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || step.name !== "camera") return;

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

      if (data.requiresUserSelection) {
        stopCamera();
        setStep({
          name: "select",
          selectionToken: data.selectionToken,
          accounts: data.users,
        });
        return;
      }

      stopCamera();
      setSession(data.user);
      const state = location.state as LocationState | null;
      navigate(state?.from ?? "/dashboard", { replace: true });
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectAccount(accountId: string): Promise<void> {
    if (step.name !== "select") return;

    setBusy(true);
    setError(null);

    try {
      const data = await selectFaceAccount(step.selectionToken, accountId);
      stopCamera();
      setSession(data.user);
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setBusy(false);
    }
  }

  function goBackToCamera(): void {
    setError(null);
    setStep({ name: "camera" });
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

          <h1 className="signin__title">📷 {t("auth.faceLogin.title")}</h1>

          <OfflineNotice />
          <AuthMethodTabs />
          <FormAlert error={error} />

          {step.name === "select" ? (
            <div className="stack">
              <h2 className="signin__subtitle">{t("auth.otpLogin.chooseAccount")}</h2>
              <p className="signin__subtitle">{t("auth.faceLogin.multipleAccounts")}</p>

              <ul className="accountlist">
                {step.accounts.map((account) => (
                  <li key={`${account.kind}-${account.id}`}>
                    <button
                      type="button"
                      className="accountlist__item"
                      disabled={busy}
                      onClick={() => {
                        void handleSelectAccount(account.id);
                      }}
                    >
                      <span className="accountlist__name">{account.name}</span>
                      <span className="accountlist__meta">
                        {account.kind === "SYSTEM_ADMIN"
                          ? t("auth.faceLogin.systemAdmin")
                          : `${account.designation?.name ?? ""}${account.employeeId ? ` · ${account.employeeId}` : ""}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <Button type="button" variant="secondary" onClick={goBackToCamera} disabled={busy}>
                {t("auth.faceLogin.tryAgain")}
              </Button>
            </div>
          ) : (
            <>
              {cameraError ? (
                <div className="alert alert--error" role="alert">
                  <span>⚠️ {cameraError}</span>
                  <button
                    type="button"
                    className="linkbutton"
                    onClick={() => {
                      void startCamera(facingMode);
                    }}
                  >
                    {t("auth.faceLogin.tryAgain")}
                  </button>
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
                  title={t("auth.faceLogin.switchCamera")}
                  aria-label={t("auth.faceLogin.switchCamera")}
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
                📸 {t("auth.faceLogin.unlockButton")}
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
