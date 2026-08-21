import { Router } from "express";

import { listShedsController, getShedController } from "./shed.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";

const router = Router();

router.get("/", requirePermission("shed:view"), listShedsController);
router.get("/:id", requirePermission("shed:view"), getShedController);

export default router;
