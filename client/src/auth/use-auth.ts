import { useContext } from "react";

import { AuthContext, type AuthContextValue } from "./auth-context.js";

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

/**
 * Permission-only gate: `can("employee:create")`.
 *
 * Never branch on role names — roles are labels, permissions are the contract.
 */
export function useCan(): (permission: string) => boolean {
  return useAuth().can;
}
