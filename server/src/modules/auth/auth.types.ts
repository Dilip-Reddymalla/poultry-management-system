export interface SafeDesignation {
  id: string;
  name: string;
}

export interface SafeUser {
  id: string;
  employeeId: string;
  email: string;
  employee: {
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

export interface UserAuthorization {
  roles: string[];
  permissions: string[];
}
