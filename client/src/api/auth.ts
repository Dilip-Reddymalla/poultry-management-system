import { ApiError, apiRequest, tryRefreshToken } from "./client.js";
import type { FaceAccount, PhoneAccount, SessionUser } from "./types.js";

interface SessionResponse {
  user: SessionUser;
}

export async function fetchSession(signal?: AbortSignal): Promise<SessionResponse> {
  try {
    return await apiRequest<SessionResponse>("/auth/me", {
      // Keep session on unauthorized initially so we can catch 401 and try silent refresh
      keepSessionOnUnauthorized: true,
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Access token expired or missing — attempt silent refresh using the 7-day refresh token cookie
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return apiRequest<SessionResponse>("/auth/me", {
          keepSessionOnUnauthorized: true,
          ...(signal ? { signal } : {}),
        });
      }
    }
    throw error;
  }
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

export type FaceLoginResponse =
  | { requiresUserSelection: false; user: SessionUser; similarity?: number }
  | {
      requiresUserSelection: true;
      selectionToken: string;
      users: FaceAccount[];
    };

export function signInWithFace(photoFile: File): Promise<FaceLoginResponse> {
  const formData = new FormData();
  formData.append("photo", photoFile);
  return apiRequest<FaceLoginResponse>("/auth/face/login", {
    method: "POST",
    body: formData,
    keepSessionOnUnauthorized: true,
  });
}

export function selectFaceAccount(
  selectionToken: string,
  accountId: string,
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/auth/face/select-user", {
    method: "POST",
    body: { selectionToken, accountId },
    keepSessionOnUnauthorized: true,
  });
}

export function signOut(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export function listSessions(): Promise<{ success: boolean; sessions: SessionInfo[] }> {
  return apiRequest<{ success: boolean; sessions: SessionInfo[] }>("/auth/sessions");
}

export function revokeSession(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(`/auth/sessions/${id}`, {
    method: "DELETE",
  });
}

export function logoutAll(): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>("/auth/logout-all", {
    method: "POST",
  });
}

// Mandatory first-login step for a provisioned account. Gated to the authenticated
// first-login session; the backend rotates the cookie and clears mustSetPassword.
export function setPassword(password: string): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/auth/set-password", {
    method: "POST",
    body: { password },
  });
}

export function updateProfilePhoto(photoFile: File): Promise<SessionResponse> {
  const formData = new FormData();
  formData.append("photo", photoFile);
  return apiRequest<SessionResponse>("/auth/me/photo", {
    method: "PATCH",
    body: formData,
  });
}

export function requestOtp(phone: string): Promise<{ phone: string }> {
  return apiRequest<{ phone: string }>("/auth/phone/request-otp", {
    method: "POST",
    body: { phone },
    keepSessionOnUnauthorized: true,
  });
}

export type PhoneSignInResponse = VerifyOtpResponse;

export function signInWithPhone(
  phone: string,
  password: string,
): Promise<PhoneSignInResponse> {
  return apiRequest<PhoneSignInResponse>("/auth/phone/login", {
    method: "POST",
    body: { phone, password },
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

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; message: string; user: SessionUser }> {
  return apiRequest("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

export function resetPassword(
  phone: string,
  otp: string,
  newPassword: string,
  email?: string,
): Promise<{ success: boolean; message: string }> {
  return apiRequest("/auth/reset-password", {
    method: "POST",
    body: { phone, otp, newPassword, email: email || undefined },
    keepSessionOnUnauthorized: true,
  });
}
