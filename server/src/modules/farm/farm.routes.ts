import { Router } from "express";

import {
  createFarmController,
  createFarmCustomRoleController,
  deactivateFarmController,
  deleteFarmCustomRoleController,
  getFarmController,
  getFarmRolesConfigController,
  getFarmShiftScheduleController,
  listFarmsController,
  reactivateFarmController,
  resetFarmShiftTimingController,
  toggleFarmSystemRoleController,
  updateFarmController,
  updateFarmCustomRoleController,
  updateFarmShiftTimingController,
} from "./farm.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";

const router = Router();

router.get("/", requirePermission("farm:view"), listFarmsController);
router.get("/:id", requirePermission("farm:view"), getFarmController);
router.post("/", requirePermission("farm:create"), createFarmController);
router.patch("/:id", requirePermission("farm:update"), updateFarmController);
router.patch(
  "/:id/deactivate",
  requirePermission("farm:deactivate"),
  deactivateFarmController,
);
router.patch(
  "/:id/reactivate",
  requirePermission("farm:reactivate"),
  reactivateFarmController,
);

// --- Farm Shift Timings ---
router.get(
  "/:id/shift-timings",
  requirePermission("farm:view"),
  getFarmShiftScheduleController,
);
router.put(
  "/:id/shift-timings/:shift",
  requirePermission("farm:update"),
  updateFarmShiftTimingController,
);
router.delete(
  "/:id/shift-timings/:shift",
  requirePermission("farm:update"),
  resetFarmShiftTimingController,
);

// --- Farm Roles Configuration ---
router.get(
  "/:id/roles-config",
  requirePermission("farm:view"),
  getFarmRolesConfigController,
);
router.patch(
  "/:id/roles/:roleId/toggle",
  requirePermission("farm:update"),
  toggleFarmSystemRoleController,
);
router.post(
  "/:id/roles",
  requirePermission("farm:update"),
  createFarmCustomRoleController,
);
router.patch(
  "/:id/roles/:roleId",
  requirePermission("farm:update"),
  updateFarmCustomRoleController,
);
router.delete(
  "/:id/roles/:roleId",
  requirePermission("farm:update"),
  deleteFarmCustomRoleController,
);

export default router;
