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
): Promise<{ photoUrl: string; faceEmbedding: number[] }> {
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

  if (!face.embedding) {
    throw new AppError("Face rejected: Unable to generate face embedding", 400);
  }

  const { url } = await cloudinaryUpload(file.buffer, folder);

  return { photoUrl: url, faceEmbedding: face.embedding };
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

  let faceData: { photoUrl?: string; faceEmbedding?: number[] } = {};

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

  let faceData: { photoUrl?: string; faceEmbedding?: number[] } = {};

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
