import { Router } from "express";

import {
  createWorkerController,
  deactivateWorkerController,
  getWorkerController,
  listWorkersController,
  reactivateWorkerController,
  updateWorkerController,
  importWorkersExcelController,
  downloadWorkerExcelTemplateController,
} from "./worker.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { uploadPhoto, uploadExcel } from "../../middlewares/upload.middleware.js";

const router = Router();

// Workers reuse the worker:view/create/update permission trio; status changes are
// a form of update, so deactivate/reactivate reuse worker:update rather than
// adding dedicated permissions.
router.get("/", requirePermission("worker:view"), listWorkersController);
router.get("/import-template", requirePermission("worker:create"), downloadWorkerExcelTemplateController);
router.post("/import-excel", requirePermission("worker:create"), uploadExcel, importWorkersExcelController);
router.get("/:id", requirePermission("worker:view"), getWorkerController);

// Create / Update accept an optional `photo` file for face enrollment.
router.post("/", requirePermission("worker:create"), uploadPhoto, createWorkerController);
router.patch("/:id", requirePermission("worker:update"), uploadPhoto, updateWorkerController);

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
