import { Router } from "express";

import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { uploadImage } from "../../middlewares/upload.middleware.js";
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
import {
  processFrameController,
  bulkMarkFaceAttendanceController,
} from "./face-attendance.controller.js";

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

// ── Face AI Attendance ──────────────────────────────────────────────────────
// Process a camera frame: detect faces → match via pgvector → return candidates.
router.post(
  "/face/process-frame",
  requirePermission("attendance:create"),
  uploadImage,
  processFrameController,
);

// Bulk-mark attendance after operator confirms face identities.
router.post(
  "/face/bulk-mark",
  requirePermission("attendance:create"),
  bulkMarkFaceAttendanceController,
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

