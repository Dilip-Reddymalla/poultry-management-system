import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  requestOtp,
  selectPhoneAccount,
  signInWithPhone,
  verifyOtp,
} from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import type { PhoneAccount } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { EggIcon } from "../../components/icons.js";
import { PhoneField } from "../../components/PhoneField.js";
import { Button, FormAlert, TextField } from "../../components/ui.js";
import { OfflineNotice } from "../../pwa/OfflineNotice.js";

type Step =
  | { name: "phone" }
  | { name: "otp" }
  | { name: "select"; selectionToken: string; accounts: PhoneAccount[] };

function toApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError(0, "Something went wrong.");
}

export function OtpLoginPage(): React.ReactElement {
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>({ name: "phone" });
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSendOtp(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await requestOtp(phone);
      setStep({ name: "otp" });
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordLogin(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const result = await signInWithPhone(phone, password);

      if (result.requiresUserSelection) {
        setStep({
          name: "select",
          selectionToken: result.selectionToken,
          accounts: result.users,
        });
        return;
      }

      setSession(result.user);
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoneSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (password.trim()) {
      await handlePasswordLogin();
    } else {
      await handleSendOtp();
    }
  }

  async function handleVerifyOtp(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await verifyOtp(phone, otp);

      if (result.requiresUserSelection) {
        // One phone number can belong to more than one account.
        setStep({
          name: "select",
          selectionToken: result.selectionToken,
          accounts: result.users,
        });

        return;
      }

      setSession(result.user);
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectAccount(userId: string): Promise<void> {
    if (step.name !== "select") {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const data = await selectPhoneAccount(step.selectionToken, userId);

      setSession(data.user);
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError(toApiError(caught));
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

          {step.name === "phone" ? (
            <form onSubmit={handlePhoneSubmit} className="stack" noValidate>
              <h1 className="signin__title">Sign in with your phone</h1>
              <p className="signin__subtitle">
                Log in with your password, or enter your number to receive an SMS code.
              </p>

              <FormAlert error={error} />

              <PhoneField
                id="phone"
                label="Phone number"
                required
                value={phone}
                hint="Select country code and enter your registered mobile number."
                errors={error?.fieldErrors.phone}
                onChange={(val) => setPhone(val)}
              />

              <TextField
                id="phone-password"
                label="Password (optional if using OTP)"
                type="password"
                autoComplete="current-password"
                value={password}
                hint="Enter your password to sign in immediately, or leave blank to receive an OTP code."
                errors={error?.fieldErrors.password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Button type="submit" variant="primary" busy={busy}>
                  {password.trim() ? "Sign in with password" : "Send OTP code"}
                </Button>
                {password.trim() ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      void handleSendOtp();
                    }}
                  >
                    Send OTP code instead
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}

          {step.name === "otp" ? (
            <form onSubmit={handleVerifyOtp} className="stack" noValidate>
              <h1 className="signin__title">Enter your code</h1>
              <p className="signin__subtitle">
                Sent to <span className="numeric">{phone}</span>.
              </p>

              <FormAlert error={error} />

              <TextField
                id="otp"
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

              <Button type="submit" variant="primary" busy={busy}>
                Verify and sign in
              </Button>

              <button
                type="button"
                className="linkbutton"
                onClick={() => {
                  setOtp("");
                  setError(null);
                  setStep({ name: "phone" });
                }}
              >
                Use a different number
              </button>
            </form>
          ) : null}

          {step.name === "select" ? (
            <div className="stack">
              <h1 className="signin__title">Choose an account</h1>
              <p className="signin__subtitle">
                This number is linked to more than one account.
              </p>

              <FormAlert error={error} />

              <ul className="accountlist">
                {step.accounts.map((account) => (
                  <li key={account.id}>
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
                        {account.designation.name} ·{" "}
                        <span className="numeric">{account.employeeId}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="signin__alt">
            <Link to="/login">Sign in with email and password instead</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
