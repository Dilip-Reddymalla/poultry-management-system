import { apiRequest } from "./client.js";
import type { PhoneAccount, SessionUser } from "./types.js";

interface SessionResponse {
  user: SessionUser;
}

export function fetchSession(signal?: AbortSignal): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/auth/me", {
    // A 401 here is the normal "not signed in yet" answer during bootstrap.
    keepSessionOnUnauthorized: true,
    ...(signal ? { signal } : {}),
  });
}

export function signIn(
  email: string,
  password: string,
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    keepSessionOnUnauthorized: true,
  });
}

export function signOut(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
}

// Mandatory first-login step for a provisioned account. Gated to the authenticated
// first-login session; the backend rotates the cookie and clears mustSetPassword.
export function setPassword(password: string): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/auth/set-password", {
    method: "POST",
    body: { password },
  });
}

export function requestOtp(phone: string): Promise<{ phone: string }> {
  return apiRequest<{ phone: string }>("/auth/phone/request-otp", {
    method: "POST",
    body: { phone },
    keepSessionOnUnauthorized: true,
  });
}

export type VerifyOtpResponse =
  | { requiresUserSelection: false; user: SessionUser }
  | {
      requiresUserSelection: true;
      selectionToken: string;
      users: PhoneAccount[];
    };

export function verifyOtp(
  phone: string,
  otp: string,
): Promise<VerifyOtpResponse> {
  return apiRequest<VerifyOtpResponse>("/auth/phone/verify-otp", {
    method: "POST",
    body: { phone, otp },
    keepSessionOnUnauthorized: true,
  });
}

export function selectPhoneAccount(
  selectionToken: string,
  userId: string,
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/auth/phone/select-user", {
    method: "POST",
    body: { selectionToken, userId },
    keepSessionOnUnauthorized: true,
  });
}
