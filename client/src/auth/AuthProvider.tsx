import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchSession, signOut as signOutRequest } from "../api/auth.js";
import { API_BASE_URL, ApiError, setSessionExpiredHandler, setSessionRefreshedHandler } from "../api/client.js";
import type { SessionUser } from "../api/types.js";
import { AuthContext, type SessionStatus } from "./auth-context.js";

/**
 * Session bootstrap: the app asks `/auth/me` once on load. 200 means the cookie
 * is valid and the app renders; 401 means sign in. No token is ever read or
 * stored by the client — the cookie is httpOnly by design.
 *
 * Silent refresh: when any API call receives a 401, the client automatically
 * attempts `POST /auth/refresh` using the 7-day httpOnly refresh cookie.
 * If successful the original request is retried transparently. If the refresh
 * also fails the user is redirected to sign-in.
 *
 * Proactive refresh: a background interval refreshes the 24h access token
 * every 20 minutes while the tab is open, preventing expiry mid-session.
 */
export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  // Track whether we are currently authenticated so the proactive refresh
  // interval knows whether to fire.
  const isAuthenticatedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchSession(controller.signal)
      .then((data) => {
        setUser(data.user);
        setStatus("authenticated");
        isAuthenticatedRef.current = true;
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setUser(null);
        setStatus("anonymous");
        isAuthenticatedRef.current = false;
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
      isAuthenticatedRef.current = false;
    });

    // When the silent refresh (in apiClient) succeeds, update in-memory user.
    setSessionRefreshedHandler((refreshedUser) => {
      if (refreshedUser && typeof refreshedUser === "object") {
        setUser(refreshedUser as SessionUser);
        setStatus("authenticated");
        isAuthenticatedRef.current = true;
      }
    });

    return () => {
      setSessionExpiredHandler(null);
      setSessionRefreshedHandler(null);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Proactive background refresh: renew the access-token every 20 minutes
  // while the tab is open, so a long session never hits the 24 h expiry wall.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

    async function doProactiveRefresh() {
      if (!isAuthenticatedRef.current) return;

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/refresh`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          },
        );

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (data?.user) {
            setUser(data.user as SessionUser);
            isAuthenticatedRef.current = true;
          }
        } else if (response.status === 401) {
          // Refresh token is also expired — sign out
          setUser(null);
          setStatus("anonymous");
          isAuthenticatedRef.current = false;
        }
        // 5xx or network errors are ignored — the access token is still valid
        // for up to 24h so occasional server hiccups shouldn't sign the user out.
      } catch {
        // Network error — ignore, token is still valid for now.
      }
    }

    // Also refresh when the tab becomes visible again (e.g. user returns after
    // leaving the tab open overnight).
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void doProactiveRefresh();
      }
    }

    const intervalId = setInterval(() => {
      void doProactiveRefresh();
    }, REFRESH_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const setSession = useCallback((nextUser: SessionUser) => {
    setUser(nextUser);
    setStatus("authenticated");
    isAuthenticatedRef.current = true;
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
      isAuthenticatedRef.current = false;
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
