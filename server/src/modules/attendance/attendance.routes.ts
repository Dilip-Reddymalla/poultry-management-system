import { Router } from "express";

import { requirePermission } from "../../middlewares/authorize.middleware.js";
import {
  approveAttendanceController,
  bulkCreateAttendanceController,
  createAttendanceController,
  exportAttendanceController,
  getAttendanceByIdController,
  getMarkedPersonIdsController,
  listAttendanceController,
  updateAttendanceController,
} from "./attendance.controller.js";

const router = Router();

// Export (Accountant/Admin) — Must precede /:id to not be caught as an ID param
router.get(
  "/export",
  requirePermission("report:export"),
  exportAttendanceController,
);

// Read
router.get(
  "/",
  requirePermission("attendance:view"),
  listAttendanceController,
);

// Get marked IDs for deduplication in UI
router.get(
  "/marked-ids",
  requirePermission("attendance:create"), // same scope as creating attendance
  getMarkedPersonIdsController,
);

router.get(
  "/:id",
  requirePermission("attendance:view"),
  getAttendanceByIdController,
);

// Write
router.post(
  "/",
  requirePermission("attendance:create"),
  createAttendanceController,
);

router.post(
  "/bulk",
  requirePermission("attendance:create"),
  bulkCreateAttendanceController,
);

router.patch(
  "/:id",
  requirePermission("attendance:update"),
  updateAttendanceController,
);

// Finalize
router.post(
  "/:id/approve",
  requirePermission("attendance:approve"),
  approveAttendanceController,
);

export default router;
