import { Router } from "express";

import {
  createCompanyController,
  getCompanyController,
  listCompaniesController,
  updateCompanyController,
} from "./company.controller.js";

import { requirePermission } from "../../middlewares/authorize.middleware.js";

const router = Router();

// company:view is held by company-level roles (and the System Admin, who bypasses
// permission checks). The list/get are still scope-filtered, so a Company Admin
// only ever sees its own company.
router.get("/", requirePermission("company:view"), listCompaniesController);
router.get("/:id", requirePermission("company:view"), getCompanyController);
// Only the System Admin effectively holds company:create (creating a company is a
// global action); the service also asserts GLOBAL scope as defense in depth.
router.post("/", requirePermission("company:create"), createCompanyController);
router.patch(
  "/:id",
  requirePermission("company:update"),
  updateCompanyController,
);

export default router;
