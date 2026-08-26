import type { NextFunction, Request, Response } from "express";
import ExcelJS from "exceljs";

import { prisma } from "../../config/database.js";
import type { AuthScope } from "../auth/scope.js";
import { farmScopedWhere } from "../auth/scope.js";
import type { ExportAttendanceQueryInput } from "./attendance.schema.js";
import { AppError } from "../../utils/app-error.js";
import type { Shift, AttendanceStatus } from "@prisma/client";

interface ExportRow {
  name: string;
  code: string;
  type: string;
  farmCode: string;
  shedNumber?: string;
  MORNING_SHIFT: AttendanceStatus | null;
  AFTERNOON_SHIFT: AttendanceStatus | null;
  NIGHT_SHIFT: AttendanceStatus | null;
  OVERTIME: AttendanceStatus | null;
}

export async function exportAttendance(
  scope: AuthScope,
  query: ExportAttendanceQueryInput,
  res: Response,
) {
  const dateFilter =
    query.date !== undefined
      ? query.date
      : query.from !== undefined || query.to !== undefined
        ? {
            ...(query.from !== undefined && { gte: query.from }),
            ...(query.to !== undefined && { lte: query.to }),
          }
        : undefined;

  const records = await prisma.attendance.findMany({
    where: {
      ...farmScopedWhere(scope),
      ...(query.farmId !== undefined && { farmId: query.farmId }),
      ...(query.shedId !== undefined && { shedId: query.shedId }),
      ...(dateFilter !== undefined && { date: dateFilter }),
      ...(query.scope === "employees" && { workerId: null }),
      ...(query.scope === "workers" && { employeeId: null }),
    },
    include: {
      farm: true,
      shed: true,
      employee: true,
      worker: true,
    },
    orderBy: [{ date: "asc" }, { farmId: "asc" }],
  });

  if (records.length === 0) {
    throw new AppError("No attendance records found for the selected criteria", 404);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Poultry Management System";

  // Group by date to potentially create multiple sheets if a date range was selected
  const recordsByDate = records.reduce((acc, record) => {
    const dateStr = record.date.toISOString().slice(0, 10);
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(record);
    return acc;
  }, {} as Record<string, typeof records>);

  for (const [dateStr, dayRecords] of Object.entries(recordsByDate)) {
    const sheet = workbook.addWorksheet(dateStr);

    sheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "ID Code", key: "code", width: 15 },
      { header: "Type", key: "type", width: 12 },
      { header: "Farm", key: "farmCode", width: 12 },
      { header: "Shed", key: "shedNumber", width: 10 },
      { header: "Morning Shift", key: "MORNING_SHIFT", width: 15 },
      { header: "Afternoon Shift", key: "AFTERNOON_SHIFT", width: 15 },
      { header: "Night Shift", key: "NIGHT_SHIFT", width: 15 },
      { header: "Overtime", key: "OVERTIME", width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Flatten multiple shifts per person into a single row per person
    const personRows = new Map<string, ExportRow>();

    for (const record of dayRecords) {
      const isEmployee = !!record.employee;
      const personId = isEmployee ? record.employee!.id : record.worker!.id;

      if (!personRows.has(personId)) {
        personRows.set(personId, {
          name: isEmployee ? record.employee!.name : record.worker!.name,
          code: isEmployee ? record.employee!.employeeId : record.worker!.workerId,
          type: isEmployee ? "Employee" : "Worker",
          farmCode: record.farm.code,
          ...(record.shed?.number ? { shedNumber: record.shed.number } : {}),
          MORNING_SHIFT: null,
          AFTERNOON_SHIFT: null,
          NIGHT_SHIFT: null,
          OVERTIME: null,
        });
      }

      const row = personRows.get(personId)!;
      row[record.shift] = record.status;
    }

    for (const row of personRows.values()) {
      sheet.addRow(row);
    }
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Attendance_Export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
  );

  await workbook.xlsx.write(res);
  res.end();
}
