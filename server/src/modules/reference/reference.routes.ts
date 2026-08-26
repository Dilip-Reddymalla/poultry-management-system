import { Router } from "express";

import {
  listDesignationsController,
  listRolesController,
} from "./reference.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";

// One module, two mount points: each list is read-only lookup data for the
// screens that write the real records, so it is gated by that screen's existing
// permission instead of a new reference-only permission. (Companies are a scoped,
// writable resource served by the company module.)

// Employee create/update forms and the employee list filter need designations.
export const designationRouter = Router();

designationRouter.get(
  "/",
  requirePermission("employee:view"),
  listDesignationsController,
);

// Roles are only ever chosen while provisioning a login account.
export const roleRouter = Router();

roleRouter.get("/", requirePermission("user:create"), listRolesController);
