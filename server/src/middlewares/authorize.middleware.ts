import type { NextFunction, Request, RequestHandler, Response } from "express";

import { getUserAuthorization } from "../modules/auth/auth.service.js";
import type { UserAuthorization } from "../modules/auth/auth.types.js";
import { requireAuth } from "./auth.middleware.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

// Authorization always runs behind requireAuth, so routes cannot be authorized
// without being authenticated first.
function authorize(
  isAllowed: (authorization: UserAuthorization) => boolean,
): RequestHandler[] {
  return [
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const authorization = await getUserAuthorization(
          (req as AuthenticatedRequest).userId,
        );

        if (!isAllowed(authorization)) {
          res.status(403).json({
            success: false,
            message: "You do not have permission to perform this action",
          });

          return;
        }

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
  return authorize((authorization) =>
    permissions.some((permission) =>
      authorization.permissions.includes(permission),
    ),
  );
}

export function requireRole(...roles: string[]): RequestHandler[] {
  return authorize((authorization) =>
    roles.some((role) => authorization.roles.includes(role)),
  );
}
