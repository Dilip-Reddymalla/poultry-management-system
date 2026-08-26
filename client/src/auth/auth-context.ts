import { createContext } from "react";

import type { SessionUser } from "../api/types.js";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: SessionStatus;
  user: SessionUser | null;
  /**
   * Permission check for UI gating. The server re-checks every permission on
   * every request, so hiding a control here is convenience, not security.
   */
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  setSession: (user: SessionUser) => void;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
