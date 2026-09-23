import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { setPassword } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { useAuth } from "../../auth/use-auth.js";
import { EggIcon } from "../../components/icons.js";
import { Button, FormAlert, TextField } from "../../components/ui.js";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher.js";
import { OfflineNotice } from "../../pwa/OfflineNotice.js";

const MIN_LENGTH = 8;

/**
 * Mandatory first step for a freshly provisioned account. The backend keeps the
 * account in a must-set-password state and refuses everything else until this
 * succeeds, so there is no way around this screen — it is not just a redirect.
 */
export function SetPasswordPage(): React.ReactElement {
  const { t } = useTranslation();
  const { user, setSession } = useAuth();
  const navigate = useNavigate();

  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    if (password !== confirm) {
      setMismatch(true);

      return;
    }

    setMismatch(false);
    setBusy(true);
    setError(null);

    try {
      const data = await setPassword(password);

      // The backend rotated the cookie and cleared mustSetPassword; adopt the
      // fresh session and drop the user into the app.
      setSession(data.user);
      navigate("/dashboard", { replace: true });
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

          <OfflineNotice />

          <form onSubmit={handleSubmit} className="stack" noValidate>
            <h1 className="signin__title">{t("auth.setPassword.title")}</h1>
            <p className="signin__subtitle">
              {t("auth.setPassword.subtitle", {
                name: user ? `, ${user.employee.name}` : "",
              })}
            </p>

            <FormAlert error={error} />

            <TextField
              id="new-password"
              label={t("auth.setPassword.newPassword")}
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              value={password}
              hint={t("auth.setPassword.passwordHint", { count: MIN_LENGTH })}
              errors={error?.fieldErrors.password}
              onChange={(event) => {
                setPasswordValue(event.target.value);
                setMismatch(false);
              }}
            />

            <TextField
              id="confirm-password"
              label={t("auth.setPassword.confirmPassword")}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              errors={mismatch ? [t("auth.setPassword.mismatchError")] : undefined}
              onChange={(event) => {
                setConfirm(event.target.value);
                setMismatch(false);
              }}
            />

            <Button type="submit" variant="primary" busy={busy}>
              {t("auth.setPassword.submitButton")}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
