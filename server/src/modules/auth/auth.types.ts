export interface SafeDesignation {
  id: string;
  name: string;
}

// The organizational reach of a session, sent to the frontend so it can label
// the current context and hide out-of-scope navigation. It is a convenience
// mirror of the backend scope — the API still enforces scope on every request.
export interface SafeUserScope {
  level: "FARM" | "COMPANY" | "GLOBAL";
  companyId: string | null;
  farmId: string | null;
}

export interface SafeUser {
  id: string;
  employeeId: string;
  email: string;
  // True only for the single env-based global administrator. Never set for a
  // company employee. The frontend uses it to reveal system-wide screens.
  isSystemAdmin: boolean;
  // Backend-enforced first-login state. While true the session may only reach
  // /auth/me, /auth/logout and /auth/set-password; every business endpoint 403s.
  mustSetPassword: boolean;
  scope: SafeUserScope;
  employee: {
    id: string;
    name: string;
    designation: SafeDesignation;
  };
  // Role names are informational only (labels, greetings). Authorization
  // decisions — client-side UI gating included — read `permissions`, which the
  // API resolves from the database on every request.
  roles: string[];
  permissions: string[];
}

export interface PhoneLoginUser {
  id: string;
  employeeId: string;
  name: string;
  designation: SafeDesignation;
}
