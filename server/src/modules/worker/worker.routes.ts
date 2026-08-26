import { Router } from "express";

import {
  createWorkerController,
  deactivateWorkerController,
  getWorkerController,
  listWorkersController,
  reactivateWorkerController,
  updateWorkerController,
} from "./worker.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";

const router = Router();

// Workers reuse the worker:view/create/update permission trio; status changes are
// a form of update, so deactivate/reactivate reuse worker:update rather than
// adding dedicated permissions.
router.get("/", requirePermission("worker:view"), listWorkersController);
router.get("/:id", requirePermission("worker:view"), getWorkerController);
router.post("/", requirePermission("worker:create"), createWorkerController);
router.patch("/:id", requirePermission("worker:update"), updateWorkerController);
router.patch(
  "/:id/deactivate",
  requirePermission("worker:update"),
  deactivateWorkerController,
);
router.patch(
  "/:id/reactivate",
  requirePermission("worker:update"),
  reactivateWorkerController,
);

export default router;
