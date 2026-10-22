import { Router } from "express";

import {
  bulkToggleCompanyRolesController,
  createCompanyController,
  getCompanyController,
  getCompanyRolesConfigController,
  getCompanyShiftScheduleController,
  listCompaniesController,
  toggleCompanyRoleController,
  updateCompanyController,
  updateCompanyRoleController,
  updateCompanyRolesHierarchyController,
  updateCompanyShiftTimingController,
} from "./company.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { uploadPhoto } from "../../middlewares/upload.middleware.js";

const router = Router();

router.get("/", requirePermission("company:view"), listCompaniesController);
router.get("/:id", requirePermission("company:view"), getCompanyController);
router.post(
  "/",
  requirePermission("company:create"),
  uploadPhoto,
  createCompanyController,
);
router.patch(
  "/:id",
  requirePermission("company:update"),
  uploadPhoto,
  updateCompanyController,
);

// Company shift schedule defaults
router.get(
  "/:id/shift-timings",
  requirePermission("company:view"),
  getCompanyShiftScheduleController,
);
router.put(
  "/:id/shift-timings/:shift",
  requirePermission("company:update"),
  updateCompanyShiftTimingController,
);

// Company roles configuration
router.get(
  "/:id/roles-config",
  requirePermission("company:view"),
  getCompanyRolesConfigController,
);
router.patch(
  "/:id/roles/bulk",
  requirePermission("company:update"),
  bulkToggleCompanyRolesController,
);
router.patch(
  "/:id/roles/:roleId/toggle",
  requirePermission("company:update"),
  toggleCompanyRoleController,
);
router.patch(
  "/:id/roles/:roleId",
  requirePermission("company:update"),
  updateCompanyRoleController,
);
router.put(
  "/:id/roles/hierarchy",
  requirePermission("company:update"),
  updateCompanyRolesHierarchyController,
);

export default router;
