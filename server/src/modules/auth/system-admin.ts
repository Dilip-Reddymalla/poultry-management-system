import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import type { SafeUser } from "./auth.types.js";

// The System Admin is not a database user. It authenticates against environment
// values and is represented in the JWT by this sentinel `sub`. It can never
// collide with a real user id, which is always a UUID.
export const SYSTEM_ADMIN_USER_ID = "system-admin";

// Label shown in the UI. It is not a seeded Role row — the System Admin has no
// UserRole and its authority is global by construction, not by permission list.
export const SYSTEM_ADMIN_ROLE = "System Admin";

export function isSystemAdminId(userId: string): boolean {
  return userId === SYSTEM_ADMIN_USER_ID;
}

// True only when the full env group is configured. Everything else in this file
// assumes the caller checked this first.
export function systemAdminEnabled(): boolean {
  return (
    env.SYSTEM_ADMIN_EMAIL !== undefined &&
    env.SYSTEM_ADMIN_PASSWORD !== undefined
  );
}

export function isSystemAdminEmail(email: string): boolean {
  if (!systemAdminEnabled()) {
    return false;
  }

  // Email is not a secret; a plain case-insensitive compare is fine here.
  return email.trim().toLowerCase() === env.SYSTEM_ADMIN_EMAIL!.toLowerCase();
}

// Constant-time password compare. Both sides are hashed to a fixed 32-byte digest
// first so timingSafeEqual never sees mismatched lengths (which would itself leak
// the length). The env password is never logged and never leaves this function.
export function verifySystemAdminPassword(password: string): boolean {
  if (!systemAdminEnabled()) {
    return false;
  }

  const provided = createHash("sha256").update(password, "utf8").digest();
  const expected = createHash("sha256")
    .update(env.SYSTEM_ADMIN_PASSWORD!, "utf8")
    .digest();

  return timingSafeEqual(provided, expected);
}

// The System Admin has no employee/designation row, so it is presented with a
// synthetic but shape-compatible SafeUser. `permissions` is the full seeded set
// so the frontend enables every control; the backend authorizes it by the
// isSystemAdmin flag, never by this list.
export async function buildSystemAdminSafeUser(): Promise<SafeUser> {
  const permissions = await prisma.permission.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });

  return {
    id: SYSTEM_ADMIN_USER_ID,
    employeeId: "SYSTEM-ADMIN",
    email: env.SYSTEM_ADMIN_EMAIL!,
    isSystemAdmin: true,
    mustSetPassword: false,
    scope: {
      level: "GLOBAL",
      companyId: null,
      farmId: null,
    },
    employee: {
      id: SYSTEM_ADMIN_USER_ID,
      name: "System Administrator",
      designation: {
        id: SYSTEM_ADMIN_USER_ID,
        name: SYSTEM_ADMIN_ROLE,
      },
    },
    roles: [SYSTEM_ADMIN_ROLE],
    permissions: permissions.map((permission) => permission.name),
  };
}
