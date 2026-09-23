import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { signIn } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { useAuth } from "../../auth/use-auth.js";
import { EggIcon } from "../../components/icons.js";
import { Button, FormAlert, TextField } from "../../components/ui.js";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher.js";
import { InstallButton } from "../../pwa/InstallButton.js";
import { OfflineNotice } from "../../pwa/OfflineNotice.js";

interface LocationState {
  from?: string;
}

/** Left-hand panel: the shed row, which is what a farm actually looks like. */
function ShedRowMotif(): React.ReactElement {
  return (
    <div className="signin__motif" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <span className="signin__shed" key={index} />
      ))}
    </div>
  );
}

export function LoginPage(): React.ReactElement {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const data = await signIn(email, password);

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
    <div className="signin">
      <aside className="signin__aside">
        <div className="signin__brand">
          <EggIcon className="signin__mark" />
          <span>
            Poultry<strong>Ops</strong>
          </span>
        </div>
        <p className="signin__lede">
          {t("auth.login.tagline")}
        </p>
        <ShedRowMotif />
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingTop: "1.5rem" }}>
          <Link to="/about" style={{ color: "#92d8a4", fontSize: "0.85rem", textDecoration: "none" }}>
            ℹ️ <strong>{t("auth.login.aboutLink")}</strong>
          </Link>
          <Link to="/analytics" style={{ color: "var(--paper)", fontSize: "0.85rem", textDecoration: "none", opacity: 0.9 }}>
            📊 <strong>{t("auth.login.analyticsLink")}</strong>
          </Link>
          <Link to="/face-ai-demo" style={{ color: "#38bdf8", fontSize: "0.85rem", textDecoration: "none" }}>
            ✨ <strong>{t("auth.login.faceAiLink")}</strong>
          </Link>
        </div>
        <p className="signin__foot eyebrow" style={{ marginTop: "1rem" }}>{t("common.internalUseOnly")}</p>
      </aside>

      <main className="signin__main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: "360px", marginBottom: "0.75rem" }}>
          <LanguageSwitcher />
          <Link
            to="/about"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--moss)",
              textDecoration: "none",
              padding: "5px 12px",
              borderRadius: "4px",
              backgroundColor: "var(--moss-soft)",
              border: "1px solid var(--line)",
            }}
          >
            <span>{t("auth.login.aboutLink")}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <form className="signin__form" onSubmit={handleSubmit} noValidate>
          <h1 className="signin__title">{t("auth.login.title")}</h1>
          <p className="signin__subtitle">
            {t("auth.login.subtitle")}
          </p>

          <OfflineNotice />

          <FormAlert error={error} />

          <TextField
            id="email"
            label={t("auth.login.email")}
            type="email"
            autoComplete="username"
            required
            value={email}
            errors={error?.fieldErrors.email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />

          <TextField
            id="password"
            label={t("auth.login.password")}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            errors={error?.fieldErrors.password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-0.5rem" }}>
            <Link to="/forgot-password" style={{ fontSize: "0.85rem" }}>
              {t("auth.login.forgotPassword")}
            </Link>
          </div>

          <Button type="submit" variant="primary" busy={busy}>
            {t("auth.login.signInButton")}
          </Button>

          <p className="signin__alt">
            {t("auth.login.noPassword")}{" "}
            <Link to="/otp-login">{t("auth.login.signInWithPhone")}</Link>
          </p>
        </form>

        <div className="signin__install">
          <InstallButton variant="secondary" />
        </div>
      </main>
    </div>
  );
}
