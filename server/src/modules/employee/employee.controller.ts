import type { Request, Response } from "express";

import { getScope } from "../../middlewares/authorize.middleware.js";
import { analyzeImage } from "../../services/face-ai.service.js";
import { uploadImage as cloudinaryUpload } from "../../services/cloudinary.service.js";
import { AppError } from "../../utils/app-error.js";

import {
  createEmployee,
  deactivateEmployee,
  getEmployeeById,
  listEmployees,
  provisionEmployeeUser,
  reactivateEmployee,
  updateEmployee,
} from "./employee.service.js";
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  listEmployeesQuerySchema,
  provisionUserSchema,
  updateEmployeeSchema,
} from "./employee.schema.js";

/**
 * Process an uploaded photo through the Face AI pipeline.
 */
async function processFacePhoto(
  file: Express.Multer.File,
  folder: string,
): Promise<{ photoUrl: string; faceEmbedding?: number[] | undefined }> {
  let embedding: number[] | undefined;

  try {
    const aiResult = await analyzeImage(file.buffer, file.originalname);
    const face = aiResult.faces[0];
    if (!face) {
      throw new AppError("No face detected in the uploaded photo", 400);
    }

    if (!face.quality.usable) {
      const reasons = face.quality.reasons.join(", ");
      throw new AppError(
        `Face rejected: Low quality — ${reasons || "does not meet quality threshold"}`,
        400,
      );
    }

    if (!face.liveness || face.liveness.decision !== "LIVE") {
      throw new AppError(
        "Face rejected: Photo spoof detected. Please use a live camera image.",
        400,
      );
    }

    if (face.embedding) {
      embedding = face.embedding;
    }
  } catch (err: any) {
    if (err instanceof AppError && err.statusCode === 400) {
      throw err;
    }
    console.warn(`[Face-AI] Warning: ${err?.message || "Service offline"}. Bypassing face embedding extraction.`);
  }

  const { url } = await cloudinaryUpload(file.buffer, folder);

  return { photoUrl: url, faceEmbedding: embedding };
}

export async function listEmployeesController(
  req: Request,
  res: Response,
): Promise<void> {
  const query = listEmployeesQuerySchema.parse(req.query);

  const { employees, pagination } = await listEmployees(getScope(req), query);

  res.status(200).json({
    success: true,
    employees,
    pagination,
  });
}

export async function getEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);

  const employee = await getEmployeeById(getScope(req), params.id);

  res.status(200).json({
    success: true,
    employee,
  });
}

export async function createEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createEmployeeSchema.parse(req.body);
  const file = req.file;

  let faceData: { photoUrl?: string | undefined; faceEmbedding?: number[] | undefined } = {};

  if (file) {
    const result = await processFacePhoto(file, "employees/profiles");
    faceData = { photoUrl: result.photoUrl, faceEmbedding: result.faceEmbedding };
  }

  const employee = await createEmployee(getScope(req), input, faceData);

  res.status(201).json({
    success: true,
    message: "Employee created successfully",
    employee,
  });
}

export async function updateEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);
  const input = updateEmployeeSchema.parse(req.body);
  const file = req.file;

  let faceData: { photoUrl?: string | undefined; faceEmbedding?: number[] | undefined } = {};

  if (file) {
    const result = await processFacePhoto(file, "employees/profiles");
    faceData = { photoUrl: result.photoUrl, faceEmbedding: result.faceEmbedding };
  }

  const employee = await updateEmployee(getScope(req), params.id, input, faceData);

  res.status(200).json({
    success: true,
    message: "Employee updated successfully",
    employee,
  });
}

export async function deactivateEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);

  const employee = await deactivateEmployee(getScope(req), params.id);

  res.status(200).json({
    success: true,
    message: "Employee deactivated successfully",
    employee,
  });
}

export async function reactivateEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);

  const employee = await reactivateEmployee(getScope(req), params.id);

  res.status(200).json({
    success: true,
    message: "Employee reactivated successfully",
    employee,
  });
}

export async function provisionEmployeeUserController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);

  const input = provisionUserSchema.parse(req.body);

  const user = await provisionEmployeeUser(getScope(req), params.id, input);

  res.status(201).json({
    success: true,
    message: "User account created successfully",
    user,
  });
}

export async function importEmployeesExcelController(
  req: Request,
  res: Response,
): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError("Please upload an Excel sheet file (.xlsx, .xls, .csv)", 400);
  }

  const { importEmployeesFromExcel } = await import("../import/excel-import.service.js");
  const summary = await importEmployeesFromExcel(getScope(req), file.buffer);

  res.status(200).json({
    success: true,
    message: `Import completed: ${summary.addedCount} added, ${summary.failedCount} failed out of ${summary.totalCount}.`,
    summary,
  });
}

export async function downloadEmployeeExcelTemplateController(
  _req: Request,
  res: Response,
): Promise<void> {
  const { generateEmployeeTemplate } = await import("../import/excel-import.service.js");
  const buffer = await generateEmployeeTemplate();

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="employee_import_template.xlsx"',
  );
  res.send(buffer);
}

