import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { signIn } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { useAuth } from "../../auth/use-auth.js";
import { EggIcon } from "../../components/icons.js";
import { Button, FormAlert, TextField } from "../../components/ui.js";
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
          : new ApiError(0, "Something went wrong."),
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
          Farms, sheds and the people who run them — in one register.
        </p>
        <ShedRowMotif />
        <p className="signin__foot eyebrow">Internal use only</p>
      </aside>

      <main className="signin__main">
        <form className="signin__form" onSubmit={handleSubmit} noValidate>
          <h1 className="signin__title">Sign in</h1>
          <p className="signin__subtitle">
            Use the work email your manager set up for you.
          </p>

          <OfflineNotice />

          <FormAlert error={error} />

          <TextField
            id="email"
            label="Email"
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
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            errors={error?.fieldErrors.password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />

          <Button type="submit" variant="primary" busy={busy}>
            Sign in
          </Button>

          <p className="signin__alt">
            No password yet? <Link to="/otp-login">Sign in with your phone</Link>
          </p>
        </form>

        <div className="signin__install">
          <InstallButton variant="secondary" />
        </div>
      </main>
    </div>
  );
}
