import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchSession, signOut as signOutRequest } from "../api/auth.js";
import { ApiError, setSessionExpiredHandler, setSessionRefreshedHandler } from "../api/client.js";
import type { SessionUser } from "../api/types.js";
import { AuthContext, type SessionStatus } from "./auth-context.js";

/**
 * Session bootstrap: the app asks `/auth/me` once on load. 200 means the cookie
 * is valid and the app renders; 401 triggers a silent refresh using poultry_refresh.
 * No token is ever read or stored by the client — cookies are httpOnly by design.
 *
 * Silent refresh: when any API call receives a 401, the client automatically
 * attempts `POST /auth/refresh` using the 7-day httpOnly refresh cookie.
 * If successful the original request is retried transparently. If the refresh
 * also fails the user is redirected to sign-in.
 *
 * Multi-tab support: No background tab-shift or interval polling is performed.
 * The 24-hour access token is shared across all tabs and renewed on-demand only
 * when an actual request needs it.
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
  // drops the app back to the sign-in screen and clears dead session cookies.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus("anonymous");
      void signOutRequest().catch(() => {});
    });

    // When the silent refresh (in apiClient) succeeds, update in-memory user.
    setSessionRefreshedHandler((refreshedUser) => {
      if (refreshedUser && typeof refreshedUser === "object") {
        setUser(refreshedUser as SessionUser);
        setStatus("authenticated");
      }
    });

    return () => {
      setSessionExpiredHandler(null);
      setSessionRefreshedHandler(null);
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
