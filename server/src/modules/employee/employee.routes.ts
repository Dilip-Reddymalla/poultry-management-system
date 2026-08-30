import { Router } from "express";

import {
  listEmployeesController,
  getEmployeeController,
  createEmployeeController,
  updateEmployeeController,
  deactivateEmployeeController,
  reactivateEmployeeController,
  provisionEmployeeUserController,
  importEmployeesExcelController,
  downloadEmployeeExcelTemplateController,
} from "./employee.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { uploadPhoto, uploadExcel } from "../../middlewares/upload.middleware.js";

const router = Router();

router.get("/", requirePermission("employee:view"), listEmployeesController);
router.get("/import-template", requirePermission("employee:create"), downloadEmployeeExcelTemplateController);
router.post("/import-excel", requirePermission("employee:create"), uploadExcel, importEmployeesExcelController);
router.get("/:id", requirePermission("employee:view"), getEmployeeController);
router.post("/", requirePermission("employee:create"), uploadPhoto, createEmployeeController);
router.patch(
  "/:id",
  requirePermission("employee:update"),
  uploadPhoto,
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
