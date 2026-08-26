import type { NextFunction, Request, RequestHandler, Response } from "express";

import { resolveScope, hasPermission } from "../modules/auth/scope.js";
import type { AuthScope } from "../modules/auth/scope.js";
import { requireAuth } from "./auth.middleware.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

// Authorization always runs behind requireAuth, so routes cannot be authorized
// without being authenticated first. The resolved scope is attached to the
// request for the controller, and a provisioned-but-not-yet-set-up account is
// blocked from every business endpoint here (only /auth/me, /auth/logout and
// /auth/set-password bypass this by using requireAuth alone).
function authorize(
  isAllowed: (scope: AuthScope) => boolean,
): RequestHandler[] {
  return [
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const scope = await resolveScope((req as AuthenticatedRequest).userId);

        if (scope.mustSetPassword) {
          res.status(403).json({
            success: false,
            code: "PASSWORD_SETUP_REQUIRED",
            message: "Set a password before using the application",
          });

          return;
        }

        if (!isAllowed(scope)) {
          res.status(403).json({
            success: false,
            message: "You do not have permission to perform this action",
          });

          return;
        }

        (req as AuthenticatedRequest).scope = scope;

        next();
      } catch (error) {
        next(error);
      }
    },
  ];
}

export function requirePermission(
  ...permissions: string[]
): RequestHandler[] {
  // The System Admin bypasses the permission list entirely (hasPermission
  // returns true), so global authority never depends on seeded rows.
  return authorize((scope) => hasPermission(scope, ...permissions));
}

export function requireRole(...roles: string[]): RequestHandler[] {
  return authorize(
    (scope) =>
      scope.isSystemAdmin || roles.some((role) => scope.roles.includes(role)),
  );
}

// Reads the scope the authorize middleware resolved and attached. Controllers
// behind requirePermission call this instead of re-resolving.
export function getScope(req: Request): AuthScope {
  const scope = (req as AuthenticatedRequest).scope;

  if (!scope) {
    // A controller was mounted without an authorize guard in front of it.
    throw new Error("Scope was not resolved: missing authorization middleware");
  }

  return scope;
}
