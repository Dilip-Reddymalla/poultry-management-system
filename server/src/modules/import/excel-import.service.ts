import ExcelJS from "exceljs";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { normalizePhone } from "../../utils/phone.js";
import type { AuthScope } from "../auth/scope.js";
import { farmScopedWhere, isFarmInScope } from "../auth/scope.js";
import { recordAuditLog } from "../audit/audit.service.js";

export interface ImportSummary {
  totalCount: number;
  addedCount: number;
  failedCount: number;
  failedExcelBase64?: string | undefined;
  filename?: string | undefined;
}

/**
 * Helper to clean cell values into strings.
 */
function getCellValueString(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return "";
  if (typeof cellValue === "object") {
    if (cellValue.text !== undefined) return String(cellValue.text).trim();
    if (cellValue.result !== undefined) return String(cellValue.result).trim();
    if (cellValue instanceof Date) return cellValue.toISOString().slice(0, 10);
  }
  return String(cellValue).trim();
}

/**
 * Generates sample template Excel for Employee Import
 */
export async function generateEmployeeTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employee Template");

  sheet.columns = [
    { header: "Employee ID (Optional)", key: "employeeId", width: 22 },
    { header: "Name (Required)", key: "name", width: 25 },
    { header: "Designation (Required)", key: "designation", width: 25 },
    { header: "Farm Code/Name (Required)", key: "farm", width: 25 },
    { header: "Phone (Optional)", key: "phone", width: 18 },
    { header: "Joining Date (YYYY-MM-DD)", key: "joiningDate", width: 22 },
  ];

  // Header styling
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" },
  };

  // Sample data rows
  sheet.addRow({
    employeeId: "EMP-101",
    name: "John Doe",
    designation: "Farm Supervisor",
    farm: "FARM-01",
    phone: "+919876543210",
    joiningDate: "2026-01-15",
  });
  sheet.addRow({
    employeeId: "",
    name: "Jane Smith",
    designation: "Veterinarian",
    farm: "FARM-01",
    phone: "+919876543211",
    joiningDate: "2026-02-01",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as any);
}

/**
 * Generates sample template Excel for Worker Import
 */
export async function generateWorkerTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Worker Template");

  sheet.columns = [
    { header: "Worker ID (Optional)", key: "workerId", width: 22 },
    { header: "Name (Required)", key: "name", width: 25 },
    { header: "Farm Code/Name (Required)", key: "farm", width: 25 },
    { header: "Phone (Optional)", key: "phone", width: 18 },
  ];

  // Header styling
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF10B981" },
  };

  // Sample data rows
  sheet.addRow({
    workerId: "WRK-101",
    name: "Ramesh Kumar",
    farm: "FARM-01",
    phone: "+919123456789",
  });
  sheet.addRow({
    workerId: "",
    name: "Suresh Patel",
    farm: "FARM-01",
    phone: "",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as any);
}

/**
 * Parses and imports Employees from an Excel spreadsheet.
 * Inserts valid records, records error reasons for failed ones, and creates an error Excel buffer.
 */
export async function importEmployeesFromExcel(
  scope: AuthScope,
  buffer: Buffer,
): Promise<ImportSummary> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount <= 1) {
    throw new AppError("Excel sheet is empty or missing data rows", 400);
  }

  // Pre-load reference data for validation
  const designations = await prisma.designation.findMany({
    select: { id: true, name: true },
  });

  const readableFarms = await prisma.farm.findMany({
    where: farmScopedWhere(scope) as any,
    select: { id: true, code: true, name: true, companyId: true },
  });

  const existingEmployees = await prisma.employee.findMany({
    select: { employeeId: true },
  });
  const existingIdSet = new Set(
    existingEmployees.map((e) => e.employeeId.toLowerCase()),
  );

  const headerRow = worksheet.getRow(1);
  const colIndexMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const headerStr = getCellValueString(cell.value).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (headerStr.includes("employeeid") || headerStr === "id" || headerStr === "empid") {
      colIndexMap["employeeId"] = colNumber;
    } else if (headerStr.includes("name") || headerStr === "fullname") {
      colIndexMap["name"] = colNumber;
    } else if (headerStr.includes("designation") || headerStr.includes("role") || headerStr.includes("job")) {
      colIndexMap["designation"] = colNumber;
    } else if (headerStr.includes("farm")) {
      colIndexMap["farm"] = colNumber;
    } else if (headerStr.includes("phone") || headerStr.includes("mobile") || headerStr.includes("contact")) {
      colIndexMap["phone"] = colNumber;
    } else if (headerStr.includes("joining") || headerStr.includes("date")) {
      colIndexMap["joiningDate"] = colNumber;
    }
  });

  // Default column mappings if headers were simple index-based or custom
  if (!colIndexMap["name"]) colIndexMap["name"] = 2; // Default 2nd col
  if (!colIndexMap["designation"]) colIndexMap["designation"] = 3; // Default 3rd col
  if (!colIndexMap["farm"]) colIndexMap["farm"] = 4; // Default 4th col

  const failedRows: Array<{
    employeeId: string;
    name: string;
    designation: string;
    farm: string;
    phone: string;
    joiningDate: string;
    errorReason: string;
  }> = [];

  let addedCount = 0;

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    const rawEmpId = getCellValueString(row.getCell(colIndexMap["employeeId"] || 1).value);
    const rawName = getCellValueString(row.getCell(colIndexMap["name"] || 2).value);
    const rawDesig = getCellValueString(row.getCell(colIndexMap["designation"] || 3).value);
    const rawFarm = getCellValueString(row.getCell(colIndexMap["farm"] || 4).value);
    const rawPhone = getCellValueString(row.getCell(colIndexMap["phone"] || 5).value);
    const rawDate = getCellValueString(row.getCell(colIndexMap["joiningDate"] || 6).value);

    // Skip totally empty rows
    if (!rawEmpId && !rawName && !rawDesig && !rawFarm && !rawPhone && !rawDate) {
      continue;
    }

    const rowErrors: string[] = [];

    // 1. Validate Name
    if (!rawName) {
      rowErrors.push("Name is required");
    }

    // 2. Validate Designation
    let matchedDesignationId: string | null = null;
    if (!rawDesig) {
      rowErrors.push("Designation is required");
    } else {
      const found = designations.find(
        (d) =>
          d.id === rawDesig ||
          d.name.toLowerCase() === rawDesig.toLowerCase(),
      );
      if (!found) {
        rowErrors.push(`Designation '${rawDesig}' not found`);
      } else {
        matchedDesignationId = found.id;
      }
    }

    // 3. Validate Farm
    let matchedFarmId: string | null = null;
    if (rawFarm) {
      const foundFarm = readableFarms.find(
        (f) =>
          f.id === rawFarm ||
          f.code.toLowerCase() === rawFarm.toLowerCase() ||
          f.name.toLowerCase() === rawFarm.toLowerCase(),
      );
      if (!foundFarm) {
        rowErrors.push(`Farm '${rawFarm}' not found or access denied`);
      } else {
        matchedFarmId = foundFarm.id;
      }
    } else if (readableFarms.length === 1) {
      matchedFarmId = readableFarms[0]!.id;
    } else {
      rowErrors.push("Farm is required");
    }

    // 4. Validate Employee ID
    if (rawEmpId) {
      if (existingIdSet.has(rawEmpId.toLowerCase())) {
        rowErrors.push(`Employee ID '${rawEmpId}' already exists`);
      }
    }

    // 5. Parse Date
    let parsedJoiningDate: Date | null = null;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        parsedJoiningDate = d;
      } else {
        rowErrors.push(`Invalid joining date '${rawDate}'`);
      }
    }

    if (rowErrors.length > 0) {
      failedRows.push({
        employeeId: rawEmpId,
        name: rawName,
        designation: rawDesig,
        farm: rawFarm,
        phone: rawPhone,
        joiningDate: rawDate,
        errorReason: rowErrors.join("; "),
      });
      continue;
    }

    // Proceed to create valid employee
    try {
      let finalEmpId = rawEmpId;
      if (!finalEmpId) {
        const count = await prisma.employee.count({
          where: { farmId: matchedFarmId! },
        });
        const farmObj = readableFarms.find((f) => f.id === matchedFarmId);
        finalEmpId = `${farmObj?.name || "FARM"}-E${count + 1 + addedCount}`;
      }

      const created = await prisma.employee.create({
        data: {
          employeeId: finalEmpId,
          name: rawName,
          desiginationId: matchedDesignationId!,
          farmId: matchedFarmId!,
          phone: rawPhone ? normalizePhone(rawPhone) : null,
          joiningDate: parsedJoiningDate,
        },
      });

      existingIdSet.add(finalEmpId.toLowerCase());
      addedCount++;

      void recordAuditLog({
        scope,
        action: "CREATE",
        entity: "Employee",
        entityId: created.id,
        summary: `Imported employee ${created.name} (${created.employeeId}) via Excel`,
        changes: { employeeId: created.employeeId, name: created.name },
      });
    } catch (err: any) {
      failedRows.push({
        employeeId: rawEmpId,
        name: rawName,
        designation: rawDesig,
        farm: rawFarm,
        phone: rawPhone,
        joiningDate: rawDate,
        errorReason: err.message || "Database insert error",
      });
    }
  }

  const totalCount = addedCount + failedRows.length;
  let failedExcelBase64: string | undefined = undefined;

  if (failedRows.length > 0) {
    const errWorkbook = new ExcelJS.Workbook();
    const errSheet = errWorkbook.addWorksheet("Failed Employees");

    errSheet.columns = [
      { header: "Employee ID", key: "employeeId", width: 20 },
      { header: "Name", key: "name", width: 25 },
      { header: "Designation", key: "designation", width: 22 },
      { header: "Farm", key: "farm", width: 22 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Joining Date", key: "joiningDate", width: 18 },
      { header: "Error Reason", key: "errorReason", width: 40 },
    ];

    errSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    errSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "EF4444" },
    };

    failedRows.forEach((r) => errSheet.addRow(r));
    const errBuffer = await errWorkbook.xlsx.writeBuffer();
    failedExcelBase64 = Buffer.from(errBuffer as any).toString("base64");
  }

  return {
    totalCount,
    addedCount,
    failedCount: failedRows.length,
    failedExcelBase64,
    filename: failedRows.length > 0 ? "employee_import_errors.xlsx" : undefined,
  };
}

/**
 * Parses and imports Workers from an Excel spreadsheet.
 */
export async function importWorkersFromExcel(
  scope: AuthScope,
  buffer: Buffer,
): Promise<ImportSummary> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount <= 1) {
    throw new AppError("Excel sheet is empty or missing data rows", 400);
  }

  const readableFarms = await prisma.farm.findMany({
    where: farmScopedWhere(scope) as any,
    select: { id: true, code: true, name: true, companyId: true },
  });

  const existingWorkers = await prisma.worker.findMany({
    select: { workerId: true },
  });
  const existingIdSet = new Set(
    existingWorkers.map((w) => w.workerId.toLowerCase()),
  );

  const headerRow = worksheet.getRow(1);
  const colIndexMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const headerStr = getCellValueString(cell.value).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (headerStr.includes("workerid") || headerStr === "id" || headerStr === "wrkid") {
      colIndexMap["workerId"] = colNumber;
    } else if (headerStr.includes("name") || headerStr === "fullname") {
      colIndexMap["name"] = colNumber;
    } else if (headerStr.includes("farm")) {
      colIndexMap["farm"] = colNumber;
    } else if (headerStr.includes("phone") || headerStr.includes("mobile") || headerStr.includes("contact")) {
      colIndexMap["phone"] = colNumber;
    }
  });

  if (!colIndexMap["name"]) colIndexMap["name"] = 2;
  if (!colIndexMap["farm"]) colIndexMap["farm"] = 3;

  const failedRows: Array<{
    workerId: string;
    name: string;
    farm: string;
    phone: string;
    errorReason: string;
  }> = [];

  let addedCount = 0;

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    const rawWrkId = getCellValueString(row.getCell(colIndexMap["workerId"] || 1).value);
    const rawName = getCellValueString(row.getCell(colIndexMap["name"] || 2).value);
    const rawFarm = getCellValueString(row.getCell(colIndexMap["farm"] || 3).value);
    const rawPhone = getCellValueString(row.getCell(colIndexMap["phone"] || 4).value);

    // Skip empty rows
    if (!rawWrkId && !rawName && !rawFarm && !rawPhone) {
      continue;
    }

    const rowErrors: string[] = [];

    // 1. Validate Name
    if (!rawName) {
      rowErrors.push("Name is required");
    }

    // 2. Validate Farm
    let matchedFarmId: string | null = null;
    if (rawFarm) {
      const foundFarm = readableFarms.find(
        (f) =>
          f.id === rawFarm ||
          f.code.toLowerCase() === rawFarm.toLowerCase() ||
          f.name.toLowerCase() === rawFarm.toLowerCase(),
      );
      if (!foundFarm) {
        rowErrors.push(`Farm '${rawFarm}' not found or access denied`);
      } else {
        matchedFarmId = foundFarm.id;
      }
    } else if (readableFarms.length === 1) {
      matchedFarmId = readableFarms[0]!.id;
    } else {
      rowErrors.push("Farm is required");
    }

    // 3. Validate Worker ID
    if (rawWrkId) {
      if (existingIdSet.has(rawWrkId.toLowerCase())) {
        rowErrors.push(`Worker ID '${rawWrkId}' already exists`);
      }
    }

    if (rowErrors.length > 0) {
      failedRows.push({
        workerId: rawWrkId,
        name: rawName,
        farm: rawFarm,
        phone: rawPhone,
        errorReason: rowErrors.join("; "),
      });
      continue;
    }

    // Proceed to create valid worker
    try {
      let finalWrkId = rawWrkId;
      if (!finalWrkId) {
        const count = await prisma.worker.count({
          where: { farmId: matchedFarmId! },
        });
        const farmObj = readableFarms.find((f) => f.id === matchedFarmId);
        finalWrkId = `${farmObj?.name || "FARM"}-W${count + 1 + addedCount}`;
      }

      const created = await prisma.worker.create({
        data: {
          workerId: finalWrkId,
          name: rawName,
          farmId: matchedFarmId!,
          phone: rawPhone ? normalizePhone(rawPhone) : null,
        },
      });

      existingIdSet.add(finalWrkId.toLowerCase());
      addedCount++;

      void recordAuditLog({
        scope,
        action: "CREATE",
        entity: "Worker",
        entityId: created.id,
        summary: `Imported worker ${created.name} (${created.workerId}) via Excel`,
        changes: { workerId: created.workerId, name: created.name },
      });
    } catch (err: any) {
      failedRows.push({
        workerId: rawWrkId,
        name: rawName,
        farm: rawFarm,
        phone: rawPhone,
        errorReason: err.message || "Database insert error",
      });
    }
  }

  const totalCount = addedCount + failedRows.length;
  let failedExcelBase64: string | undefined = undefined;

  if (failedRows.length > 0) {
    const errWorkbook = new ExcelJS.Workbook();
    const errSheet = errWorkbook.addWorksheet("Failed Workers");

    errSheet.columns = [
      { header: "Worker ID", key: "workerId", width: 20 },
      { header: "Name", key: "name", width: 25 },
      { header: "Farm", key: "farm", width: 22 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Error Reason", key: "errorReason", width: 40 },
    ];

    errSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    errSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "EF4444" },
    };

    failedRows.forEach((r) => errSheet.addRow(r));
    const errBuffer = await errWorkbook.xlsx.writeBuffer();
    failedExcelBase64 = Buffer.from(errBuffer as any).toString("base64");
  }

  return {
    totalCount,
    addedCount,
    failedCount: failedRows.length,
    failedExcelBase64,
    filename: failedRows.length > 0 ? "worker_import_errors.xlsx" : undefined,
  };
}
