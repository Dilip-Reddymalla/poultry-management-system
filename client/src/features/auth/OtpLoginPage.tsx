import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher.js";
import { OfflineNotice } from "../../pwa/OfflineNotice.js";

type Step =
  | { name: "phone" }
  | { name: "otp" }
  | { name: "select"; selectionToken: string; accounts: PhoneAccount[] };

export function OtpLoginPage(): React.ReactElement {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>({ name: "phone" });
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  function toApiError(caught: unknown): ApiError {
    return caught instanceof ApiError
      ? caught
      : new ApiError(0, t("error.somethingWentWrong"));
  }

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

          {step.name === "phone" ? (
            <form onSubmit={handlePhoneSubmit} className="stack" noValidate>
              <h1 className="signin__title">{t("auth.otpLogin.title")}</h1>
              <p className="signin__subtitle">
                {t("auth.otpLogin.subtitle")}
              </p>

              <FormAlert error={error} />

              <PhoneField
                id="phone"
                label={t("auth.otpLogin.phoneNumber")}
                required
                value={phone}
                hint={t("auth.otpLogin.phoneHint")}
                errors={error?.fieldErrors.phone}
                onChange={(val) => setPhone(val)}
              />

              <TextField
                id="phone-password"
                label={t("auth.otpLogin.passwordOptional")}
                type="password"
                autoComplete="current-password"
                value={password}
                hint={t("auth.otpLogin.passwordHint")}
                errors={error?.fieldErrors.password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-0.25rem" }}>
                <Link to="/forgot-password" style={{ fontSize: "0.85rem" }}>
                  {t("auth.otpLogin.forgotPassword")}
                </Link>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Button type="submit" variant="primary" busy={busy}>
                  {password.trim() ? t("auth.otpLogin.signInWithPassword") : t("auth.otpLogin.sendOtpCode")}
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
                    {t("auth.otpLogin.sendOtpInstead")}
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}

          {step.name === "otp" ? (
            <form onSubmit={handleVerifyOtp} className="stack" noValidate>
              <h1 className="signin__title">{t("auth.otpLogin.enterCodeTitle")}</h1>
              <p className="signin__subtitle">
                {t("auth.otpLogin.sentTo")} <span className="numeric">{phone}</span>.
              </p>

              <FormAlert error={error} />

              <TextField
                id="otp"
                label={t("auth.otpLogin.sixDigitCode")}
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
                {t("auth.otpLogin.verifyAndSignIn")}
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
                {t("auth.otpLogin.useDifferentNumber")}
              </button>
            </form>
          ) : null}

          {step.name === "select" ? (
            <div className="stack">
              <h1 className="signin__title">{t("auth.otpLogin.chooseAccount")}</h1>
              <p className="signin__subtitle">
                {t("auth.otpLogin.multipleAccounts")}
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
            <Link to="/login">{t("auth.otpLogin.signInWithEmail")}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
