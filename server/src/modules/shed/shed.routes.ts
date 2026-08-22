import { Router } from "express";

import {
  createShedController,
  getShedController,
  listShedsController,
  updateShedController,
  updateShedStatusController,
} from "./shed.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";

const router = Router();

router.get("/", requirePermission("shed:view"), listShedsController);
router.get("/:id", requirePermission("shed:view"), getShedController);
router.post("/", requirePermission("shed:create"), createShedController);
router.patch("/:id", requirePermission("shed:update"), updateShedController);
router.patch(
  "/:id/status",
  requirePermission("shed:update-status"),
  updateShedStatusController,
);

export default router;
