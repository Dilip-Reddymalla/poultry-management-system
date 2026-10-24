import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import {
  app,
  cleanupTestData,
  containsSensitiveFields,
  createActor,
  createTestCompany,
  createTestEmployeeRecord,
  createTestFarm,
  createTestWorker,
  loginSystemAdmin,
  prisma,
  type TestActor,
} from "./helpers.js";

// Each attendance record is unique per person+date, so the suite hands out a
// fresh calendar day per create to avoid accidental duplicate-key collisions.
// Tests that specifically exercise the duplicate rule reuse a single date.
let dayCounter = 0;

function testDate(): string {
  dayCounter += 1;
  const day = ((dayCounter - 1) % 27) + 1;
  const month = 4 + Math.floor((dayCounter - 1) / 27);

  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

describe("attendance module", () => {
  let systemAdminCookie: string;
  // Supervisor: attendance:view + attendance:create (records only).
  let supervisor: TestActor;
  // DGM: adds attendance:update + attendance:approve (corrects/finalizes).
  let dgm: TestActor;
  // Accountant: attendance:view only (no create/update/approve).
  let accountant: TestActor;

  let farmA1Id: string;
  let employeeA1Id: string;
  let workerA1Id: string;
  let employeeA2Id: string;
  let employeeBId: string;

  async function record(
    cookie: string,
    body: Record<string, unknown>,
  ): Promise<request.Response> {
    return request(app).post("/api/attendance").set("Cookie", cookie).send({
      shift: "MORNING_SHIFT",
      latitude: 12.0,
      longitude: 77.0,
      ...body
    });
  }

  beforeAll(async () => {
    await cleanupTestData();

    const companyA = await createTestCompany();
    const companyB = await createTestCompany();
    const farmA1 = await createTestFarm("ACTIVE", companyA.id);
    const farmA2 = await createTestFarm("ACTIVE", companyA.id);
    const farmB1 = await createTestFarm("ACTIVE", companyB.id);

    farmA1Id = farmA1.id;

    employeeA1Id = (await createTestEmployeeRecord(farmA1.id)).id;
    workerA1Id = (await createTestWorker(farmA1.id)).id;
    employeeA2Id = (await createTestEmployeeRecord(farmA2.id)).id;
    employeeBId = (await createTestEmployeeRecord(farmB1.id)).id;

    systemAdminCookie = await loginSystemAdmin();
    supervisor = await createActor("Supervisor", { farmId: farmA1.id });
    dgm = await createActor("DGM", { farmId: farmA1.id });
    accountant = await createActor("Accountant", { farmId: farmA1.id });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/attendance");

    expect(response.status).toBe(401);
  });

  it("records employee attendance within the caller's farm", async () => {
    const response = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date: testDate(),
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Attendance recorded successfully");
    expect(response.body.attendance.status).toBe("PRESENT");
    expect(response.body.attendance.person.type).toBe("EMPLOYEE");
    expect(response.body.attendance.person.id).toBe(employeeA1Id);
    expect(response.body.attendance.farm.id).toBe(farmA1Id);
    expect(response.body.attendance.recordedBy).not.toBeNull();
    expect(typeof response.body.attendance.recordedBy.id).toBe("string");
    expect(typeof response.body.attendance.recordedBy.name).toBe("string");
    expect(response.body.attendance.approvedBy).not.toBeNull();
    expect(response.body.attendance.approvedAt).not.toBeNull();
    expect(containsSensitiveFields(response.body)).toBe(false);
  });

  it("records worker attendance", async () => {
    const response = await record(supervisor.cookie, {
      workerId: workerA1Id,
      date: testDate(),
      status: "ABSENT",
    });

    expect(response.status).toBe(201);
    expect(response.body.attendance.person.type).toBe("WORKER");
    expect(response.body.attendance.person.id).toBe(workerA1Id);
    expect(response.body.attendance.status).toBe("ABSENT");
  });

  it("prevents duplicate attendance for the same person and date", async () => {
    const date = testDate();

    const first = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date,
    });

    expect(first.status).toBe(201);

    const second = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date,
    });

    expect(second.status).toBe(409);
  });

  it("rejects a record naming neither a person", async () => {
    const response = await record(supervisor.cookie, { date: testDate() });

    expect(response.status).toBe(400);
  });

  it("rejects a record naming both an employee and a worker", async () => {
    const response = await record(supervisor.cookie, {
      date: testDate(),
      employeeId: employeeA1Id,
      workerId: workerA1Id,
    });

    expect(response.status).toBe(400);
  });

  it("rejects a malformed date", async () => {
    const response = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date: "2026/04/01",
    });

    expect(response.status).toBe(400);
  });



  it("rejects attendance for an inactive person", async () => {
    const employee = await createTestEmployeeRecord(farmA1Id);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { status: "INACTIVE" },
    });

    const response = await record(supervisor.cookie, {
      employeeId: employee.id,
      date: testDate(),
    });

    expect(response.status).toBe(409);
  });

  it("denies recording attendance in another farm of the same company", async () => {
    const response = await record(supervisor.cookie, {
      employeeId: employeeA2Id,
      date: testDate(),
    });

    expect(response.status).toBe(403);
  });

  it("denies recording attendance in another company", async () => {
    const response = await record(dgm.cookie, {
      employeeId: employeeBId,
      date: testDate(),
    });

    expect(response.status).toBe(403);
  });

  it("allows attendance creation to the Accountant role", async () => {
    const response = await record(accountant.cookie, {
      employeeId: employeeA1Id,
      date: testDate(),
    });

    expect(response.status).toBe(201);
  });

  it("denies attendance creation to non-supervisory roles (e.g. Driver)", async () => {
    const driver = await createActor("Driver", { farmId: farmA1Id });
    const response = await record(driver.cookie, {
      employeeId: employeeA1Id,
      date: testDate(),
    });

    expect(response.status).toBe(403);
  });

  it("lets a DGM correct a record", async () => {
    const created = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date: testDate(),
    });

    const response = await request(app)
      .patch(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", dgm.cookie)
      .send({ status: "HALF_DAY", notes: "Left early" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Attendance updated successfully");
    expect(response.body.attendance.status).toBe("HALF_DAY");
    expect(response.body.attendance.notes).toBe("Left early");
  });

  it("denies correction to the Supervisor role", async () => {
    const created = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date: testDate(),
    });

    const response = await request(app)
      .patch(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", supervisor.cookie)
      .send({ status: "ABSENT" });

    expect(response.status).toBe(403);
  });

  it("lets a DGM approve a record and rejects a second approval", async () => {
    const created = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date: testDate(),
    });

    // Update the record to reset approval state to pending
    await request(app)
      .patch(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", dgm.cookie)
      .send({ notes: "Trigger pending state" });

    const approved = await request(app)
      .post(`/api/attendance/${created.body.attendance.id}/approve`)
      .set("Cookie", dgm.cookie);

    expect(approved.status).toBe(200);
    expect(approved.body.message).toBe("Attendance approved successfully");
    expect(approved.body.attendance.approvedBy).not.toBeNull();
    expect(approved.body.attendance.approvedAt).not.toBeNull();

    const repeated = await request(app)
      .post(`/api/attendance/${created.body.attendance.id}/approve`)
      .set("Cookie", dgm.cookie);

    expect(repeated.status).toBe(409);
  });

  it("denies approval to the Supervisor role", async () => {
    const created = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date: testDate(),
    });

    // Update to pending state first
    await request(app)
      .patch(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", dgm.cookie)
      .send({ notes: "Pending" });

    const response = await request(app)
      .post(`/api/attendance/${created.body.attendance.id}/approve`)
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(403);
  });

  it("clears approval when an approved record is corrected", async () => {
    const created = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date: testDate(),
    });

    // Update to pending state
    await request(app)
      .patch(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", dgm.cookie)
      .send({ notes: "Pending" });

    await request(app)
      .post(`/api/attendance/${created.body.attendance.id}/approve`)
      .set("Cookie", dgm.cookie);

    const corrected = await request(app)
      .patch(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", dgm.cookie)
      .send({ status: "LEAVE" });

    expect(corrected.status).toBe(200);
    expect(corrected.body.attendance.approvedBy).toBeNull();
    expect(corrected.body.attendance.approvedAt).toBeNull();
  });

  it("denies correcting a record in another farm", async () => {
    // Seeded across the farm boundary by the global System Admin.
    const created = await record(systemAdminCookie, {
      employeeId: employeeA2Id,
      date: testDate(),
    });

    const response = await request(app)
      .patch(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", dgm.cookie)
      .send({ status: "ABSENT" });

    expect(response.status).toBe(403);
  });

  it("hides an out-of-scope record as not found", async () => {
    const created = await record(systemAdminCookie, {
      employeeId: employeeBId,
      date: testDate(),
    });

    const response = await request(app)
      .get(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(404);
  });

  it("returns an in-scope record by id", async () => {
    const created = await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date: testDate(),
    });

    const response = await request(app)
      .get(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);
    expect(response.body.attendance.id).toBe(created.body.attendance.id);
  });

  it("scopes the attendance list to the caller's farm", async () => {
    const response = await request(app)
      .get("/api/attendance")
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.attendance)).toBe(true);
    for (const item of response.body.attendance) {
      expect(item.farm.id).toBe(farmA1Id);
    }
  });

  it("filters the list by employee", async () => {
    const response = await request(app)
      .get("/api/attendance")
      .set("Cookie", supervisor.cookie)
      .query({ employeeId: employeeA1Id });

    expect(response.status).toBe(200);
    for (const item of response.body.attendance) {
      expect(item.person.type).toBe("EMPLOYEE");
      expect(item.person.id).toBe(employeeA1Id);
    }
  });

  it("filters the list by date", async () => {
    const date = testDate();

    await record(supervisor.cookie, { workerId: workerA1Id, date });

    const response = await request(app)
      .get("/api/attendance")
      .set("Cookie", supervisor.cookie)
      .query({ date });

    expect(response.status).toBe(200);
    expect(response.body.attendance.length).toBeGreaterThan(0);
    for (const item of response.body.attendance) {
      expect(item.date).toBe(date);
    }
  });

  it("paginates the list", async () => {
    const response = await request(app)
      .get("/api/attendance")
      .set("Cookie", supervisor.cookie)
      .query({ page: 1, limit: 1 });

    expect(response.status).toBe(200);
    expect(response.body.attendance.length).toBeLessThanOrEqual(1);
    expect(response.body.pagination.limit).toBe(1);
  });

  it("lets the System Admin read and finalize attendance in any company", async () => {
    const created = await record(systemAdminCookie, {
      employeeId: employeeBId,
      date: testDate(),
    });

    const list = await request(app)
      .get("/api/attendance")
      .set("Cookie", systemAdminCookie)
      .query({ farmId: created.body.attendance.farm.id });

    expect(list.status).toBe(200);
    const ids = list.body.attendance.map((a: { id: string }) => a.id);
    expect(ids).toContain(created.body.attendance.id);

    // Update to reset approval state to pending
    await request(app)
      .patch(`/api/attendance/${created.body.attendance.id}`)
      .set("Cookie", systemAdminCookie)
      .send({ notes: "Trigger pending" });

    const approved = await request(app)
      .post(`/api/attendance/${created.body.attendance.id}/approve`)
      .set("Cookie", systemAdminCookie);

    expect(approved.status).toBe(200);
    // The System Admin has no user row, so the approver audit link is null.
    expect(approved.body.attendance.approvedBy).toBeNull();
    expect(approved.body.attendance.approvedAt).not.toBeNull();
  });

  it("fetches unmarked summary preview for a date and shift", async () => {
    const date = testDate();

    const response = await request(app)
      .get("/api/attendance/unmarked-summary")
      .set("Cookie", supervisor.cookie)
      .query({
        date,
        shift: "MORNING_SHIFT",
        farmId: farmA1Id,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.unmarkedEmployees).toBeInstanceOf(Array);
    expect(response.body.unmarkedWorkers).toBeInstanceOf(Array);
    expect(typeof response.body.totalUnmarked).toBe("number");
    expect(response.body.totalUnmarked).toBeGreaterThan(0);
  });

  it("marks all unmarked workforce as ABSENT in bulk", async () => {
    const date = testDate();

    const response = await request(app)
      .post("/api/attendance/mark-unmarked-absent")
      .set("Cookie", supervisor.cookie)
      .send({
        date,
        shift: "MORNING_SHIFT",
        farmId: farmA1Id,
        target: "ALL",
        latitude: 12.0,
        longitude: 77.0,
        notes: "Shift ended - auto absent",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.markedCount).toBeGreaterThan(0);

    // Re-query unmarked summary to verify they are now marked
    const afterSummary = await request(app)
      .get("/api/attendance/unmarked-summary")
      .set("Cookie", supervisor.cookie)
      .query({
        date,
        shift: "MORNING_SHIFT",
        farmId: farmA1Id,
      });

    expect(afterSummary.status).toBe(200);
    expect(afterSummary.body.totalUnmarked).toBe(0);
  });

  it("exports attendance Excel with date sheets and extra summary pages for Employees and Workers", async () => {
    const date = testDate();

    // Record morning, afternoon, and overtime for employee
    await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date,
      shift: "MORNING_SHIFT",
    });
    await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date,
      shift: "AFTERNOON_SHIFT",
    });
    await record(supervisor.cookie, {
      employeeId: employeeA1Id,
      date,
      shift: "OVERTIME",
    });

    // Record morning only (half day) for worker
    await record(supervisor.cookie, {
      workerId: workerA1Id,
      date,
      shift: "MORNING_SHIFT",
    });

    const response = await request(app)
      .get("/api/attendance/export")
      .set("Cookie", accountant.cookie)
      .query({
        date,
        farmId: farmA1Id,
        scope: "all",
      })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body);

    const sheetNames = workbook.worksheets.map((w) => w.name);
    // Must include the date sheet, then Employees, then Workers at the end
    expect(sheetNames).toContain(date);
    expect(sheetNames).toContain("Employees");
    expect(sheetNames).toContain("Workers");
    expect(sheetNames[sheetNames.length - 2]).toBe("Employees");
    expect(sheetNames[sheetNames.length - 1]).toBe("Workers");

    // Inspect Employees sheet
    const empSheet = workbook.getWorksheet("Employees")!;
    expect(empSheet).toBeDefined();
    // Headers in row 1
    expect(empSheet.getRow(1).getCell(1).value).toBe("Emp ID");
    expect(empSheet.getRow(1).getCell(2).value).toBe("Full Name");
    expect(empSheet.getRow(1).getCell(3).value).toBe("Photo URL");
    expect(empSheet.getRow(1).getCell(4).value).toBe("Total Full Days");
    expect(empSheet.getRow(1).getCell(5).value).toBe("Total Half Days");
    expect(empSheet.getRow(1).getCell(6).value).toBe("Total OT");
    expect(empSheet.getRow(1).getCell(7).value).toBe("Total Working Days (Without Half Days)");
    expect(empSheet.getRow(1).getCell(8).value).toBe("Total Working Days (With Half Days)");

    // Must have a Role row (e.g. "Role: ...")
    let foundRoleRow = false;
    let foundEmpRow = false;
    empSheet.eachRow((row) => {
      const cell1Val = String(row.getCell(1).value ?? "");
      if (cell1Val.startsWith("Role:")) {
        foundRoleRow = true;
      }
      if (cell1Val.startsWith("EMP-") || row.getCell(2).value) {
        foundEmpRow = true;
      }
    });
    expect(foundRoleRow).toBe(true);
    expect(foundEmpRow).toBe(true);

    // Inspect Workers sheet
    const wrkSheet = workbook.getWorksheet("Workers")!;
    expect(wrkSheet).toBeDefined();
    expect(wrkSheet.getRow(1).getCell(1).value).toBe("Worker ID");
    expect(wrkSheet.getRow(1).getCell(2).value).toBe("Full Name");
    expect(wrkSheet.getRow(1).getCell(3).value).toBe("Photo URL");

    // In Workers sheet, there should be NO role header rows
    let foundRoleInWorkers = false;
    wrkSheet.eachRow((row) => {
      const cell1Val = String(row.getCell(1).value ?? "");
      if (cell1Val.startsWith("Role:")) {
        foundRoleInWorkers = true;
      }
    });
    expect(foundRoleInWorkers).toBe(false);
  });
});
