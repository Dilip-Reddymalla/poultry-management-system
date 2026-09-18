import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { requestOtp, resetPassword } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { EggIcon } from "../../components/icons.js";
import { PhoneField } from "../../components/PhoneField.js";
import { Button, FormAlert, TextField } from "../../components/ui.js";
import { OfflineNotice } from "../../pwa/OfflineNotice.js";

type Step = "request" | "reset" | "success";

export function ForgotPasswordPage(): React.ReactElement {
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
          phone: ["Please enter your phone number"],
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
          : new ApiError(0, "Failed to send verification code. Please try again."),
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
          otp: ["Enter the complete 6-digit OTP code"],
        }),
      );
      return;
    }

    if (newPassword.length < 8) {
      setError(
        new ApiError(400, "Validation error", {
          newPassword: ["Password must be at least 8 characters"],
        }),
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        new ApiError(400, "Validation error", {
          confirmPassword: ["Passwords do not match"],
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
          : new ApiError(0, "Failed to reset password. Please check your OTP and try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin signin--single">
      <main className="signin__main">
        <div className="signin__form">
          <div className="signin__brand signin__brand--dark">
            <EggIcon className="signin__mark" />
            <span>
              Poultry<strong>Ops</strong>
            </span>
          </div>

          <OfflineNotice />

          {step === "request" ? (
            <form onSubmit={handleSendOtp} className="stack" noValidate>
              <h1 className="signin__title">Reset password</h1>
              <p className="signin__subtitle">
                Enter the registered phone number associated with your account to receive an OTP.
              </p>

              <FormAlert error={error} />

              <PhoneField
                id="reset-phone"
                label="Registered phone number"
                required
                value={phone}
                hint="Select country code and enter your mobile number."
                errors={error?.fieldErrors.phone}
                onChange={(val: string) => setPhone(val)}
              />

              <Button type="submit" variant="primary" busy={busy}>
                Send OTP code
              </Button>

              <p className="signin__alt">
                Remember your password? <Link to="/login">Sign in</Link>
              </p>
            </form>
          ) : null}

          {step === "reset" ? (
            <form onSubmit={handleResetPassword} className="stack" noValidate>
              <h1 className="signin__title">Create new password</h1>
              <p className="signin__subtitle">
                We sent a 6-digit verification code to{" "}
                <span className="numeric">{phone}</span>.
              </p>

              <FormAlert error={error} />

              <TextField
                id="reset-otp"
                label="Six-digit code"
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
                label="Work email (optional)"
                type="email"
                autoComplete="email"
                value={email}
                hint="Only required if multiple employees share this phone number."
                errors={error?.fieldErrors.email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />

              <TextField
                id="reset-new-password"
                label="New password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={newPassword}
                hint="Must be at least 8 characters long."
                errors={error?.fieldErrors.newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                }}
              />

              <TextField
                id="reset-confirm-password"
                label="Confirm new password"
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
                  {showPassword ? "Hide passwords" : "Show passwords"}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Button type="submit" variant="primary" busy={busy}>
                  Reset password
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
                  Change phone number
                </Button>
              </div>

              <p className="signin__alt">
                Remember your password? <Link to="/login">Sign in</Link>
              </p>
            </form>
          ) : null}

          {step === "success" ? (
            <div className="stack" style={{ textAlign: "center", padding: "1rem 0" }}>
              <h1 className="signin__title">Password reset!</h1>
              <p className="signin__subtitle">
                Your password has been successfully updated. You can now sign in with your new password.
              </p>

              <Button
                type="button"
                variant="primary"
                onClick={() => navigate("/login", { replace: true })}
              >
                Sign in now
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
