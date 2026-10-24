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

interface PersonSummaryItem {
  id: string;
  code: string;
  name: string;
  photoUrl: string | null;
  roleName: string;
}

interface PersonDayShifts {
  MORNING_SHIFT?: AttendanceStatus;
  AFTERNOON_SHIFT?: AttendanceStatus;
  NIGHT_SHIFT?: AttendanceStatus;
  OVERTIME?: AttendanceStatus;
}

interface PersonStats {
  totalFullDays: number;
  totalHalfDays: number;
  totalOT: number;
  workingDaysWithoutHalfDays: number;
  workingDaysWithHalfDays: number;
}

const ROLE_RANKS: Record<string, number> = {
  "System Admin": 100,
  "CEO": 95,
  "Company Admin": 90,
  "GM": 85,
  "DGM": 80,
  "Assistant Manager": 70,
  "Super Incharge": 65,
  "Incharge": 60,
  "Asst Incharge": 55,
  "Accountant": 50,
  "Accounts Assistant": 45,
  "Stores Executive": 45,
  "Senior Supervisor": 40,
  "Supervisor": 35,
  "AC Supervisor": 35,
  "Maintenance Supervisor": 35,
  "Grading Supervisor": 35,
  "Supervisor - Litter Maintenance": 35,
  "Security Supervisor": 35,
  "Asst Supervisor": 30,
  "AC Asst Supervisor": 30,
  "Asst Supervisor General": 30,
  "Asst Supervisor - Technical": 30,
  "Asst Supervisor - Electrical": 30,
  "Security Head Guard": 20,
  "Senior Driver": 18,
  "Security Guard": 15,
  "Driver": 15,
};

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
      employee: {
        include: {
          designation: true,
          user: {
            include: {
              roles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
      },
      worker: true,
    },
    orderBy: [{ date: "asc" }, { farmId: "asc" }],
  });

  if (records.length === 0) {
    throw new AppError("No attendance records found for the selected criteria", 404);
  }

  // Fetch active workforce within the farm/scope so that all members of every role appear
  const [activeEmployees, activeWorkers] = await Promise.all([
    query.scope !== "workers"
      ? prisma.employee.findMany({
          where: {
            ...farmScopedWhere(scope),
            ...(query.farmId !== undefined && { farmId: query.farmId }),
            status: "ACTIVE",
          },
          include: {
            designation: true,
            user: {
              include: {
                roles: {
                  include: {
                    role: true,
                  },
                },
              },
            },
          },
          orderBy: [{ name: "asc" }],
        })
      : [],
    query.scope !== "employees"
      ? prisma.worker.findMany({
          where: {
            ...farmScopedWhere(scope),
            ...(query.farmId !== undefined && { farmId: query.farmId }),
            status: "ACTIVE",
          },
          orderBy: [{ name: "asc" }],
        })
      : [],
  ]);

  // Index employees
  const employeeMap = new Map<string, PersonSummaryItem>();
  for (const emp of activeEmployees) {
    const roleName =
      emp.designation?.name ||
      emp.user?.roles?.[0]?.role?.name ||
      "General Staff";
    employeeMap.set(emp.id, {
      id: emp.id,
      code: emp.employeeId,
      name: emp.name,
      photoUrl: emp.photoUrl,
      roleName,
    });
  }
  for (const record of records) {
    if (record.employee && !employeeMap.has(record.employee.id)) {
      const roleName =
        record.employee.designation?.name ||
        record.employee.user?.roles?.[0]?.role?.name ||
        "General Staff";
      employeeMap.set(record.employee.id, {
        id: record.employee.id,
        code: record.employee.employeeId,
        name: record.employee.name,
        photoUrl: record.employee.photoUrl,
        roleName,
      });
    }
  }

  // Index workers
  const workerMap = new Map<string, PersonSummaryItem>();
  for (const wrk of activeWorkers) {
    workerMap.set(wrk.id, {
      id: wrk.id,
      code: wrk.workerId,
      name: wrk.name,
      photoUrl: wrk.photoUrl,
      roleName: "",
    });
  }
  for (const record of records) {
    if (record.worker && !workerMap.has(record.worker.id)) {
      workerMap.set(record.worker.id, {
        id: record.worker.id,
        code: record.worker.workerId,
        name: record.worker.name,
        photoUrl: record.worker.photoUrl,
        roleName: "",
      });
    }
  }

  // Aggregate attendance by personId -> dateStr -> DayShifts
  const attendanceByPersonAndDate = new Map<string, Map<string, PersonDayShifts>>();

  for (const record of records) {
    const personId = record.employeeId ?? record.workerId;
    if (!personId) continue;
    const dateStr = record.date.toISOString().slice(0, 10);

    let personDates = attendanceByPersonAndDate.get(personId);
    if (!personDates) {
      personDates = new Map<string, PersonDayShifts>();
      attendanceByPersonAndDate.set(personId, personDates);
    }

    let dayShifts = personDates.get(dateStr);
    if (!dayShifts) {
      dayShifts = {};
      personDates.set(dateStr, dayShifts);
    }

    dayShifts[record.shift] = record.status;
  }

  function getPersonStats(personId: string): PersonStats {
    const personDates = attendanceByPersonAndDate.get(personId);
    let totalFullDays = 0;
    let totalHalfDays = 0;
    let totalOT = 0;

    if (personDates) {
      for (const [, shifts] of personDates.entries()) {
        // Total OT: strictly isolated, not included in any working days total
        if (shifts.OVERTIME === "PRESENT" || shifts.OVERTIME === "HALF_DAY") {
          totalOT += 1;
        }

        const isMorningPresent = shifts.MORNING_SHIFT === "PRESENT";
        const isAfternoonPresent = shifts.AFTERNOON_SHIFT === "PRESENT";
        const isNightPresent = shifts.NIGHT_SHIFT === "PRESENT";

        const isMorningHalf = shifts.MORNING_SHIFT === "HALF_DAY";
        const isAfternoonHalf = shifts.AFTERNOON_SHIFT === "HALF_DAY";
        const isNightHalf = shifts.NIGHT_SHIFT === "HALF_DAY";

        // Full day = morning + afternoon (or night shift for night workers)
        if ((isMorningPresent && isAfternoonPresent) || isNightPresent) {
          totalFullDays += 1;
        } else if (
          isMorningPresent ||
          isAfternoonPresent ||
          isMorningHalf ||
          isAfternoonHalf ||
          isNightHalf
        ) {
          totalHalfDays += 1;
        }
      }
    }

    return {
      totalFullDays,
      totalHalfDays,
      totalOT,
      workingDaysWithoutHalfDays: totalFullDays,
      workingDaysWithHalfDays: totalFullDays + totalHalfDays * 0.5,
    };
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Poultry Management System";

  // Group by date to create sheets for each date in the range
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

  // Add Employees summary sheet at the end of all dates
  if (query.scope !== "workers" || employeeMap.size > 0) {
    const empSheet = workbook.addWorksheet("Employees");

    empSheet.columns = [
      { header: "Emp ID", key: "code", width: 16 },
      { header: "Full Name", key: "name", width: 28 },
      { header: "Photo URL", key: "photo", width: 28 },
      { header: "Total Full Days", key: "fullDays", width: 18 },
      { header: "Total Half Days", key: "halfDays", width: 18 },
      { header: "Total OT", key: "ot", width: 14 },
      { header: "Total Working Days (Without Half Days)", key: "workingDaysNoHalf", width: 34 },
      { header: "Total Working Days (With Half Days)", key: "workingDaysWithHalf", width: 32 },
    ];

    const headerRow = empSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    headerRow.height = 28;

    // Group employees by role
    const employeesByRole = new Map<string, PersonSummaryItem[]>();
    for (const emp of employeeMap.values()) {
      if (!employeesByRole.has(emp.roleName)) {
        employeesByRole.set(emp.roleName, []);
      }
      employeesByRole.get(emp.roleName)!.push(emp);
    }

    const sortedRoles = Array.from(employeesByRole.keys()).sort((a, b) => {
      const rankA = ROLE_RANKS[a] ?? 25;
      const rankB = ROLE_RANKS[b] ?? 25;
      if (rankA !== rankB) return rankB - rankA;
      return a.localeCompare(b);
    });

    for (const roleName of sortedRoles) {
      const roleEmployees = employeesByRole.get(roleName)!;
      roleEmployees.sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name));

      // Row with the Role of the employee
      const roleRow = empSheet.addRow([`Role: ${roleName}`]);
      const roleRowNum = roleRow.number;
      empSheet.mergeCells(roleRowNum, 1, roleRowNum, 8);
      roleRow.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
      roleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
      roleRow.height = 22;
      roleRow.alignment = { vertical: "middle", indent: 1 };

      // List all the members in that role
      for (const emp of roleEmployees) {
        const stats = getPersonStats(emp.id);
        const dataRow = empSheet.addRow({
          code: emp.code,
          name: emp.name,
          photo: "",
          fullDays: stats.totalFullDays,
          halfDays: stats.totalHalfDays,
          ot: stats.totalOT,
          workingDaysNoHalf: stats.workingDaysWithoutHalfDays,
          workingDaysWithHalf: stats.workingDaysWithHalfDays,
        });

        const rowNum = dataRow.number;

        // Working days formulas
        dataRow.getCell("workingDaysNoHalf").value = {
          formula: `D${rowNum}`,
          result: stats.workingDaysWithoutHalfDays,
        };
        dataRow.getCell("workingDaysWithHalf").value = {
          formula: `D${rowNum}+(E${rowNum}*0.5)`,
          result: stats.workingDaysWithHalfDays,
        };
        dataRow.getCell("workingDaysWithHalf").numFmt = "0.#";

        // Photo URL as a hyperlink mentioning the name again
        const photoCell = dataRow.getCell("photo");
        if (emp.photoUrl && emp.photoUrl.trim() !== "") {
          photoCell.value = {
            text: emp.name,
            hyperlink: emp.photoUrl,
            tooltip: `View photo of ${emp.name}`,
          };
          photoCell.font = {
            color: { argb: "FF1D4ED8" },
            underline: true,
          };
        } else {
          photoCell.value = "No Photo";
          photoCell.font = {
            color: { argb: "FF94A3B8" },
            italic: true,
          };
        }

        // Cell alignments & styling
        dataRow.getCell("code").alignment = { vertical: "middle", horizontal: "center" };
        dataRow.getCell("name").alignment = { vertical: "middle", horizontal: "left" };
        dataRow.getCell("photo").alignment = { vertical: "middle", horizontal: "center" };
        dataRow.getCell("fullDays").alignment = { vertical: "middle", horizontal: "center" };
        dataRow.getCell("halfDays").alignment = { vertical: "middle", horizontal: "center" };
        dataRow.getCell("ot").alignment = { vertical: "middle", horizontal: "center" };
        dataRow.getCell("workingDaysNoHalf").alignment = { vertical: "middle", horizontal: "center" };
        dataRow.getCell("workingDaysWithHalf").alignment = { vertical: "middle", horizontal: "center" };

        dataRow.height = 20;
        dataRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      }
    }
  }

  // Add Workers summary sheet at the end of all dates (same format without roles)
  if (query.scope !== "employees" || workerMap.size > 0) {
    const wrkSheet = workbook.addWorksheet("Workers");

    wrkSheet.columns = [
      { header: "Worker ID", key: "code", width: 16 },
      { header: "Full Name", key: "name", width: 28 },
      { header: "Photo URL", key: "photo", width: 28 },
      { header: "Total Full Days", key: "fullDays", width: 18 },
      { header: "Total Half Days", key: "halfDays", width: 18 },
      { header: "Total OT", key: "ot", width: 14 },
      { header: "Total Working Days (Without Half Days)", key: "workingDaysNoHalf", width: 34 },
      { header: "Total Working Days (With Half Days)", key: "workingDaysWithHalf", width: 32 },
    ];

    const wrkHeaderRow = wrkSheet.getRow(1);
    wrkHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    wrkHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF065F46" },
    };
    wrkHeaderRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    wrkHeaderRow.height = 28;

    const workersList = Array.from(workerMap.values()).sort(
      (a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name),
    );

    for (const wrk of workersList) {
      const stats = getPersonStats(wrk.id);
      const dataRow = wrkSheet.addRow({
        code: wrk.code,
        name: wrk.name,
        photo: "",
        fullDays: stats.totalFullDays,
        halfDays: stats.totalHalfDays,
        ot: stats.totalOT,
        workingDaysNoHalf: stats.workingDaysWithoutHalfDays,
        workingDaysWithHalf: stats.workingDaysWithHalfDays,
      });

      const rowNum = dataRow.number;

      dataRow.getCell("workingDaysNoHalf").value = {
        formula: `D${rowNum}`,
        result: stats.workingDaysWithoutHalfDays,
      };
      dataRow.getCell("workingDaysWithHalf").value = {
        formula: `D${rowNum}+(E${rowNum}*0.5)`,
        result: stats.workingDaysWithHalfDays,
      };
      dataRow.getCell("workingDaysWithHalf").numFmt = "0.#";

      // Photo URL as a hyperlink mentioning the name again
      const photoCell = dataRow.getCell("photo");
      if (wrk.photoUrl && wrk.photoUrl.trim() !== "") {
        photoCell.value = {
          text: wrk.name,
          hyperlink: wrk.photoUrl,
          tooltip: `View photo of ${wrk.name}`,
        };
        photoCell.font = {
          color: { argb: "FF1D4ED8" },
          underline: true,
        };
      } else {
        photoCell.value = "No Photo";
        photoCell.font = {
          color: { argb: "FF94A3B8" },
          italic: true,
        };
      }

      dataRow.getCell("code").alignment = { vertical: "middle", horizontal: "center" };
      dataRow.getCell("name").alignment = { vertical: "middle", horizontal: "left" };
      dataRow.getCell("photo").alignment = { vertical: "middle", horizontal: "center" };
      dataRow.getCell("fullDays").alignment = { vertical: "middle", horizontal: "center" };
      dataRow.getCell("halfDays").alignment = { vertical: "middle", horizontal: "center" };
      dataRow.getCell("ot").alignment = { vertical: "middle", horizontal: "center" };
      dataRow.getCell("workingDaysNoHalf").alignment = { vertical: "middle", horizontal: "center" };
      dataRow.getCell("workingDaysWithHalf").alignment = { vertical: "middle", horizontal: "center" };

      dataRow.height = 20;
      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
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
