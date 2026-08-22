import { Router } from "express";

import {
  createFarmController,
  deactivateFarmController,
  getFarmController,
  listFarmsController,
  reactivateFarmController,
  updateFarmController,
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

export default router;
