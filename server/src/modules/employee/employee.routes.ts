import { Router } from "express";

import {
  listEmployeesController,
  getEmployeeController,
  createEmployeeController,
  updateEmployeeController,
  deactivateEmployeeController,
  reactivateEmployeeController,
  provisionEmployeeUserController,
} from "./employee.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";

const router = Router();

router.get("/", requirePermission("employee:view"), listEmployeesController);
router.get("/:id", requirePermission("employee:view"), getEmployeeController);
router.post("/", requirePermission("employee:create"), createEmployeeController);
router.patch(
  "/:id",
  requirePermission("employee:update"),
  updateEmployeeController,
);
router.patch(
  "/:id/deactivate",
  requirePermission("employee:deactivate"),
  deactivateEmployeeController,
);
router.patch(
  "/:id/reactivate",
  requirePermission("employee:reactivate"),
  reactivateEmployeeController,
);
router.post(
  "/:id/user",
  requirePermission("user:create"),
  provisionEmployeeUserController,
);

export default router;
