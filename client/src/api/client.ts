/**
 * The single door to the API. Every request goes through here so the base URL,
 * the session cookie, JSON handling and error shape are decided in one place.
 */

const rawBaseUrl: unknown =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL = (
  typeof rawBaseUrl === "string" && rawBaseUrl.trim().length > 0
    ? rawBaseUrl.trim()
    : "http://localhost:5000/api"
).replace(/\/+$/, "");

export type FieldErrors = Record<string, string[]>;

/** Normalized failure: every error path in the app throws one of these. */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;
  /** Per-field messages from Zod validation, keyed by field name. */
  readonly fieldErrors: FieldErrors;
  /** Validation messages that belong to the form as a whole. */
  readonly formErrors: string[];

  constructor(
    status: number,
    message: string,
    fieldErrors: FieldErrors = {},
    formErrors: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.formErrors = formErrors;
  }

  /** True when the user is signed in but lacks the required permission. */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, any>;
  signal?: AbortSignal | undefined;
  /**
   * Sign-in endpoints answer 401 for wrong credentials, which is a form error
   * rather than an expired session, so they opt out of the global handler.
   */
  keepSessionOnUnauthorized?: boolean;
}

type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;

/** AuthProvider registers here so any 401 drops the app back to sign-in. */
export function setSessionExpiredHandler(
  handler: SessionExpiredHandler | null,
): void {
  sessionExpiredHandler = handler;
}

function buildUrl(
  path: string,
  query: ApiRequestOptions["query"],
): string {
  const url = new URL(`${API_BASE_URL}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

interface ErrorEnvelope {
  message?: unknown;
  errors?: unknown;
  formErrors?: unknown;
}

function readFieldErrors(errors: unknown): FieldErrors {
  if (typeof errors !== "object" || errors === null) {
    return {};
  }

  const result: FieldErrors = {};

  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages)) {
      result[field] = messages.filter(
        (message): message is string => typeof message === "string",
      );
    }
  }

  return result;
}

function readFormErrors(formErrors: unknown): string[] {
  return Array.isArray(formErrors)
    ? formErrors.filter((message): message is string => typeof message === "string")
    : [];
}

const FALLBACK_MESSAGES: Record<number, string> = {
  401: "Your session has ended. Sign in again to continue.",
  403: "You do not have permission to do that.",
  404: "That record no longer exists.",
  429: "Too many attempts. Wait a moment and try again.",
  500: "The server ran into a problem. Try again.",
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, signal } = options;

  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      // The session lives in an httpOnly cookie, so every call must carry it.
      credentials: "include",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      0,
      "Cannot reach the server. Check that the API is running.",
    );
  }

  const payload: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = (payload ?? {}) as ErrorEnvelope;

    const message =
      typeof envelope.message === "string"
        ? envelope.message
        : (FALLBACK_MESSAGES[response.status] ?? "Something went wrong.");

    if (response.status === 401 && !options.keepSessionOnUnauthorized) {
      sessionExpiredHandler?.();
    }

    throw new ApiError(
      response.status,
      message,
      readFieldErrors(envelope.errors),
      readFormErrors(envelope.formErrors),
    );
  }

  return payload as T;
}

// Convenience wrapper so callers can write `apiClient.get(...)` instead of
// `apiRequest(path, { method: "GET", ... })`.
export const apiClient = {
  get<T = any>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "GET" });
  },
  post<T = any>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "POST", body });
  },
  patch<T = any>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "PATCH", body });
  },
  put<T = any>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "PUT", body });
  },
  delete<T = any>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "DELETE" });
  },
};
