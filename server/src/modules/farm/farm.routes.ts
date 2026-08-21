import { Router } from "express";

import { listFarmsController, getFarmController } from "./farm.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";

const router = Router();

router.get("/", requirePermission("farm:view"), listFarmsController);
router.get("/:id", requirePermission("farm:view"), getFarmController);

export default router;
