import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { requestOtp, resetPassword } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { EggIcon } from "../../components/icons.js";
import { PhoneField } from "../../components/PhoneField.js";
import { Button, FormAlert, TextField } from "../../components/ui.js";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher.js";
import { OfflineNotice } from "../../pwa/OfflineNotice.js";

type Step = "request" | "reset" | "success";

export function ForgotPasswordPage(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("request");
  const [phone, setPhone] = useState("+91");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSendOtp(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!phone || phone === "+91") {
      setError(
        new ApiError(400, "Validation error", {
          phone: [t("auth.forgotPassword.validationPhoneRequired")],
        }),
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await requestOtp(phone);
      setStep("reset");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, t("auth.forgotPassword.errorSendingOtp")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    if (!otp || otp.length !== 6) {
      setError(
        new ApiError(400, "Validation error", {
          otp: [t("auth.forgotPassword.validationOtpIncomplete")],
        }),
      );
      return;
    }

    if (newPassword.length < 8) {
      setError(
        new ApiError(400, "Validation error", {
          newPassword: [t("auth.forgotPassword.validationPasswordTooShort")],
        }),
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        new ApiError(400, "Validation error", {
          confirmPassword: [t("auth.forgotPassword.validationPasswordMismatch")],
        }),
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await resetPassword(phone, otp, newPassword, email.trim() || undefined);
      setStep("success");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, t("auth.forgotPassword.errorResettingPassword")),
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

          <OfflineNotice />

          {step === "request" ? (
            <form onSubmit={handleSendOtp} className="stack" noValidate>
              <h1 className="signin__title">{t("auth.forgotPassword.resetTitle")}</h1>
              <p className="signin__subtitle">
                {t("auth.forgotPassword.resetSubtitle")}
              </p>

              <FormAlert error={error} />

              <PhoneField
                id="reset-phone"
                label={t("auth.forgotPassword.registeredPhone")}
                required
                value={phone}
                hint={t("auth.forgotPassword.phoneHint")}
                errors={error?.fieldErrors.phone}
                onChange={(val: string) => setPhone(val)}
              />

              <Button type="submit" variant="primary" busy={busy}>
                {t("auth.forgotPassword.sendOtp")}
              </Button>

              <p className="signin__alt">
                {t("auth.forgotPassword.rememberPassword")}{" "}
                <Link to="/login">{t("auth.forgotPassword.signIn")}</Link>
              </p>
            </form>
          ) : null}

          {step === "reset" ? (
            <form onSubmit={handleResetPassword} className="stack" noValidate>
              <h1 className="signin__title">{t("auth.forgotPassword.newPasswordTitle")}</h1>
              <p className="signin__subtitle">
                {t("auth.forgotPassword.codeSentTo")}{" "}
                <span className="numeric">{phone}</span>.
              </p>

              <FormAlert error={error} />

              <TextField
                id="reset-otp"
                label={t("auth.forgotPassword.sixDigitCode")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className="input--code numeric"
                value={otp}
                errors={error?.fieldErrors.otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, ""));
                }}
              />

              <TextField
                id="reset-email"
                label={t("auth.forgotPassword.workEmailOptional")}
                type="email"
                autoComplete="email"
                value={email}
                hint={t("auth.forgotPassword.workEmailHint")}
                errors={error?.fieldErrors.email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />

              <TextField
                id="reset-new-password"
                label={t("auth.forgotPassword.newPassword")}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={newPassword}
                hint={t("auth.forgotPassword.newPasswordHint")}
                errors={error?.fieldErrors.newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                }}
              />

              <TextField
                id="reset-confirm-password"
                label={t("auth.forgotPassword.confirmNewPassword")}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                errors={error?.fieldErrors.confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    color: "var(--color-primary-600, #2563eb)",
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? t("common.hidePasswords") : t("common.showPasswords")}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Button type="submit" variant="primary" busy={busy}>
                  {t("auth.forgotPassword.resetPasswordButton")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setStep("request");
                    setOtp("");
                    setError(null);
                  }}
                >
                  {t("auth.forgotPassword.changePhoneNumber")}
                </Button>
              </div>

              <p className="signin__alt">
                {t("auth.forgotPassword.rememberPassword")}{" "}
                <Link to="/login">{t("auth.forgotPassword.signIn")}</Link>
              </p>
            </form>
          ) : null}

          {step === "success" ? (
            <div className="stack" style={{ textAlign: "center", padding: "1rem 0" }}>
              <h1 className="signin__title">{t("auth.forgotPassword.successTitle")}</h1>
              <p className="signin__subtitle">
                {t("auth.forgotPassword.successSubtitle")}
              </p>

              <Button
                type="button"
                variant="primary"
                onClick={() => navigate("/login", { replace: true })}
              >
                {t("auth.forgotPassword.signInNow")}
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
