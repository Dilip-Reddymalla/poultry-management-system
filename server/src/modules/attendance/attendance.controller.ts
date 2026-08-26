import type { Request, Response } from "express";

import { getScope } from "../../middlewares/authorize.middleware.js";
import {
  approveAttendance,
  createAttendance,
  bulkCreateAttendance,
  getAttendanceById,
  listAttendance,
  updateAttendance,
  getMarkedPersonIds,
} from "./attendance.service.js";
import { exportAttendance } from "./attendance.export.js";
import {
  attendanceIdParamSchema,
  createAttendanceSchema,
  bulkCreateAttendanceSchema,
  listAttendanceQuerySchema,
  updateAttendanceSchema,
  markedPersonIdsQuerySchema,
  exportAttendanceQuerySchema,
} from "./attendance.schema.js";

export async function listAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const query = listAttendanceQuerySchema.parse(req.query);
  const { attendance, pagination } = await listAttendance(getScope(req), query);

  res.status(200).json({
    success: true,
    attendance,
    pagination,
  });
}

export async function getAttendanceByIdController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = attendanceIdParamSchema.parse(req.params);
  const record = await getAttendanceById(getScope(req), params.id);

  res.status(200).json({
    success: true,
    attendance: record,
  });
}

export async function createAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createAttendanceSchema.parse(req.body);
  const record = await createAttendance(getScope(req), input);

  res.status(201).json({
    success: true,
    message: "Attendance recorded successfully",
    attendance: record,
  });
}

export async function updateAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = attendanceIdParamSchema.parse(req.params);
  const input = updateAttendanceSchema.parse(req.body);
  const record = await updateAttendance(getScope(req), params.id, input);

  res.status(200).json({
    success: true,
    message: "Attendance updated successfully",
    attendance: record,
  });
}

export async function approveAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = attendanceIdParamSchema.parse(req.params);
  const record = await approveAttendance(getScope(req), params.id);

  res.status(200).json({
    success: true,
    message: "Attendance approved successfully",
    attendance: record,
  });
}

export async function bulkCreateAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = bulkCreateAttendanceSchema.parse(req.body);
  const results = await bulkCreateAttendance(getScope(req), input);

  res.status(207).json({
    success: true,
    message: "Bulk attendance processed",
    results,
  });
}

export async function getMarkedPersonIdsController(
  req: Request,
  res: Response,
): Promise<void> {
  const query = markedPersonIdsQuerySchema.parse(req.query);
  const markedIds = await getMarkedPersonIds(getScope(req), query);

  res.status(200).json({
    success: true,
    ...markedIds,
  });
}

export async function exportAttendanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const query = exportAttendanceQuerySchema.parse(req.query);
  await exportAttendance(getScope(req), query, res);
}
