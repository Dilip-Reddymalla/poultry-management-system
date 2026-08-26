import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchSession, signOut as signOutRequest } from "../api/auth.js";
import { ApiError, setSessionExpiredHandler } from "../api/client.js";
import type { SessionUser } from "../api/types.js";
import { AuthContext, type SessionStatus } from "./auth-context.js";

/**
 * Session bootstrap: the app asks `/auth/me` once on load. 200 means the cookie
 * is valid and the app renders; 401 means sign in. No token is ever read or
 * stored by the client — the cookie is httpOnly by design.
 */
export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchSession(controller.signal)
      .then((data) => {
        setUser(data.user);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setUser(null);
        setStatus("anonymous");
      });

    return () => {
      controller.abort();
    };
  }, []);

  // Any later 401 — expired token, deactivated account, revoked session —
  // drops the app back to the sign-in screen instead of failing silently.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus("anonymous");
    });

    return () => {
      setSessionExpiredHandler(null);
    };
  }, []);

  const setSession = useCallback((nextUser: SessionUser) => {
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutRequest();
    } catch (error) {
      // A dead session is already signed out; anything else still ends locally.
      if (!(error instanceof ApiError)) {
        throw error;
      }
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const value = useMemo(() => {
    const granted = new Set(user?.permissions ?? []);

    return {
      status,
      user,
      can: (permission: string) => granted.has(permission),
      canAny: (...permissions: string[]) =>
        permissions.some((permission) => granted.has(permission)),
      setSession,
      signOut,
    };
  }, [status, user, setSession, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
