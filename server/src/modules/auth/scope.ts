import { Prisma, type ScopeLevel } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import {
  SYSTEM_ADMIN_ROLE,
  isSystemAdminId,
} from "./system-admin.js";

// The resolved authority of a caller for one request: WHAT it may do
// (permissions) and WHERE it may do it (scope level relative to its own farm and
// company). Never trust roles/permissions/scope from the JWT, body, query or
// params — this is always resolved from the database (or, for the System Admin,
// from the sentinel identity).
export interface AuthScope {
  // The single global administrator. When true, every scope check passes and
  // permission checks are bypassed. It has no user/employee row, so userId,
  // employeeId, farmId and companyId are all null.
  isSystemAdmin: boolean;

  // Database user id, or null for the System Admin. Used for audit columns
  // (attendance.recordedById/approvedById) which are nullable precisely because
  // the System Admin has no row to reference.
  userId: string | null;
  employeeId: string | null;

  // The caller's home farm/company, derived from its employee. null for the
  // System Admin (global) only.
  farmId: string | null;
  companyId: string | null;

  // Broadest scope across the caller's roles. FARM < COMPANY < GLOBAL.
  level: ScopeLevel;

  // While true, the account has been provisioned but not yet completed password
  // setup; business endpoints are blocked until it does.
  mustSetPassword: boolean;

  roles: string[];
  permissions: string[];
}

const SCOPE_RANK: Record<ScopeLevel, number> = {
  FARM: 0,
  COMPANY: 1,
  GLOBAL: 2,
};

function broadest(levels: ScopeLevel[]): ScopeLevel {
  return levels.reduce<ScopeLevel>(
    (widest, level) => (SCOPE_RANK[level] > SCOPE_RANK[widest] ? level : widest),
    "FARM",
  );
}

export { broadest as broadestScopeLevel };

const scopeUserSelect = {
  id: true,
  isActive: true,
  mustSetPassword: true,
  employee: {
    select: {
      id: true,
      status: true,
      farmId: true,
      farm: {
        select: {
          companyId: true,
        },
      },
    },
  },
  roles: {
    select: {
      role: {
        select: {
          name: true,
          scopeLevel: true,
          permissions: {
            select: {
              permission: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

// Resolves the full authority of a caller. The System Admin sentinel short-
// circuits to a global scope with no database read.
export async function resolveScope(userId: string): Promise<AuthScope> {
  if (isSystemAdminId(userId)) {
    return {
      isSystemAdmin: true,
      userId: null,
      employeeId: null,
      farmId: null,
      companyId: null,
      level: "GLOBAL",
      mustSetPassword: false,
      roles: [SYSTEM_ADMIN_ROLE],
      permissions: [],
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: scopeUserSelect,
  });

  if (!user || !user.isActive || user.employee.status !== "ACTIVE") {
    throw new AppError("Authentication required", 401);
  }

  const permissions = new Set<string>();
  const roles: string[] = [];
  const levels: ScopeLevel[] = [];

  for (const userRole of user.roles) {
    roles.push(userRole.role.name);
    levels.push(userRole.role.scopeLevel);

    for (const rolePermission of userRole.role.permissions) {
      permissions.add(rolePermission.permission.name);
    }
  }

  return {
    isSystemAdmin: false,
    userId: user.id,
    employeeId: user.employee.id,
    farmId: user.employee.farmId,
    companyId: user.employee.farm.companyId,
    level: broadest(levels),
    mustSetPassword: user.mustSetPassword,
    roles,
    permissions: Array.from(permissions),
  };
}

export function hasPermission(scope: AuthScope, ...permissions: string[]): boolean {
  if (scope.isSystemAdmin) {
    return true;
  }

  return permissions.some((permission) => scope.permissions.includes(permission));
}

// --- Scope predicates -----------------------------------------------------
//
// WHERE a permission applies. A resource is reachable when the caller is global,
// or its company matches (COMPANY scope), or its farm matches (FARM scope).

export function isCompanyInScope(scope: AuthScope, companyId: string): boolean {
  if (scope.isSystemAdmin || scope.level === "GLOBAL") {
    return true;
  }

  return scope.companyId === companyId;
}

export function isFarmInScope(
  scope: AuthScope,
  farm: { companyId: string; id?: string },
  farmId?: string,
): boolean {
  if (scope.isSystemAdmin || scope.level === "GLOBAL") {
    return true;
  }

  if (scope.level === "COMPANY") {
    return scope.companyId === farm.companyId;
  }

  // FARM scope
  return scope.farmId === (farmId ?? farm.id);
}

// --- Prisma where fragments ----------------------------------------------
//
// Applied to list queries so scope is enforced in the database, never in the
// frontend. `undefined` means "no constraint" (global) and is safe to spread.

// For models with a `farmId` column and a `farm.companyId` path (Shed, Employee,
// Worker, Attendance).
export function farmScopedWhere(
  scope: AuthScope,
): { farmId?: string; farm?: { companyId: string } } | undefined {
  if (scope.isSystemAdmin || scope.level === "GLOBAL") {
    return undefined;
  }

  if (scope.level === "COMPANY") {
    return { farm: { companyId: scope.companyId! } };
  }

  return { farmId: scope.farmId! };
}

// For the Farm model itself (has `id` and `companyId`).
export function farmModelScopedWhere(
  scope: AuthScope,
): { id?: string; companyId?: string } | undefined {
  if (scope.isSystemAdmin || scope.level === "GLOBAL") {
    return undefined;
  }

  if (scope.level === "COMPANY") {
    return { companyId: scope.companyId! };
  }

  return { id: scope.farmId! };
}

// For the Company model itself (matched by `id`). A FARM- or COMPANY-scoped
// caller can only ever see its own company.
export function companyModelScopedWhere(
  scope: AuthScope,
): { id?: string } | undefined {
  if (scope.isSystemAdmin || scope.level === "GLOBAL") {
    return undefined;
  }

  return { id: scope.companyId! };
}

// --- Assertions -----------------------------------------------------------
//
// Read of an out-of-scope resource → 404 (never confirm it exists). Write into
// an out-of-scope farm/company → 403 (the resource is real but forbidden).

export function assertCompanyWritable(scope: AuthScope, companyId: string): void {
  if (!isCompanyInScope(scope, companyId)) {
    throw new AppError("You do not have permission to perform this action", 403);
  }
}

export function assertFarmWritable(
  scope: AuthScope,
  farm: { companyId: string; id?: string },
  farmId?: string,
): void {
  if (!isFarmInScope(scope, farm, farmId)) {
    throw new AppError("You do not have permission to perform this action", 403);
  }
}
