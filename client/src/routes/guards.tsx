import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/use-auth.js";
import { EmptyState } from "../components/ui.js";
import { PageHeader } from "../layout/PageHeader.js";

/** The one place the app waits for the session answer from `/auth/me`. */
function SessionSplash(): React.ReactElement {
  return (
    <div className="splash">
      <span className="spinner spinner--lg" role="status">
        <span className="visually-hidden">Checking your session</span>
      </span>
    </div>
  );
}

export function ProtectedRoute(): React.ReactElement {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <SessionSplash />;
  }

  if (status === "anonymous") {
    // 401 from the API means unauthenticated: send the user to sign in and
    // remember where they were headed.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute(): React.ReactElement {
  const { status } = useAuth();

  if (status === "loading") {
    return <SessionSplash />;
  }

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

/**
 * A provisioned account starts in a first-login state: the backend rejects its
 * requests until a password is set. This mirrors that in the UI by funnelling
 * such a user to the set-password screen before any app route renders.
 */
export function RequirePasswordSet(): React.ReactElement {
  const { user } = useAuth();

  if (user?.mustSetPassword) {
    return <Navigate to="/set-password" replace />;
  }

  return <Outlet />;
}

/** The set-password screen is only for an account that still owes a password. */
export function RequirePasswordPending(): React.ReactElement {
  const { user } = useAuth();

  if (!user?.mustSetPassword) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

/**
 * 403 is different from 401: the user is signed in, they simply cannot use this
 * screen. Say so instead of bouncing them to sign-in.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { can } = useAuth();

  if (!can(permission)) {
    return (
      <div className="stack">
        <PageHeader title="Not available to your role" />
        <EmptyState
          title="You do not have access to this screen"
          description={`This screen needs the ${permission} permission. Ask a manager to grant it, or head back to the overview.`}
        />
      </div>
    );
  }

  return <>{children}</>;
}
