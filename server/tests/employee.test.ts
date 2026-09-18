import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  containsSensitiveFields,
  createActor,
  createTestCompany,
  createTestEmployeeRecord,
  createTestFarm,
  getDesignationId,
  prisma,
  TEST_EMAIL_DOMAIN,
  TEST_PREFIX,
  uniqueSuffix,
  type TestActor,
} from "./helpers.js";

describe("employee module", () => {
  // All three actors share ONE farm so the FARM-scoped roles can operate on the
  // same employees: an employee always belongs to a farm, and a FARM-scoped role
  // may only write within its own farm.
  let dgm: TestActor;
  let accountant: TestActor;
  let accountsAssistant: TestActor;
  let incharge: TestActor;
  let supervisor: TestActor;
  let farmId: string;
  let designationId: string;
  let supervisorRoleId: string;

  beforeAll(async () => {
    await cleanupTestData();

    const farm = await createTestFarm();
    farmId = farm.id;

    dgm = await createActor("DGM", { farmId });
    accountant = await createActor("Accountant", { farmId });
    accountsAssistant = await createActor("Accounts Assistant", { farmId });
    incharge = await createActor("Incharge", { farmId });
    supervisor = await createActor("Supervisor", { farmId });

    designationId = await getDesignationId();

    const role = await prisma.role.findUniqueOrThrow({
      where: { name: "Supervisor" },
      select: { id: true },
    });

    supervisorRoleId = role.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("creates an employee", async () => {
    const employeeId = `${TEST_PREFIX}${uniqueSuffix()}`;

    const response = await request(app)
      .post("/api/employees")
      .set("Cookie", dgm.cookie)
      .send({ employeeId, name: "Created Employee", designationId, farmId });

    expect(response.status).toBe(201);
    expect(response.body.employee.employeeId).toBe(employeeId);
    expect(response.body.employee.hasUser).toBe(false);
    expect(containsSensitiveFields(response.body)).toBe(false);
  });

  it("generates the next employee ID from the target farm only", async () => {
    const company = await createTestCompany();
    const farmA = await createTestFarm("ACTIVE", company.id);
    const farmB = await createTestFarm("ACTIVE", company.id);
    const companyAdmin = await createActor("Company Admin", {
      farmId: farmA.id,
    });

    for (let index = 0; index < 5; index += 1) {
      await createTestEmployeeRecord(farmA.id);
    }

    const seededEmployeeId = `${TEST_PREFIX}${uniqueSuffix()}-E1`;

    const seeded = await request(app)
      .post("/api/employees")
      .set("Cookie", companyAdmin.cookie)
      .send({
        employeeId: seededEmployeeId,
        name: "Seeded Farm B Employee",
        designationId,
        farmId: farmB.id,
      });

    expect(seeded.status).toBe(201);

    const response = await request(app)
      .post("/api/employees")
      .set("Cookie", companyAdmin.cookie)
      .send({
        name: "Farm B Auto ID",
        designationId,
        farmId: farmB.id,
      });

    expect(response.status).toBe(201);
    expect(response.body.employee.employeeId).toBe("Test Farm-E2");
  });

  it("rejects a duplicate employee ID", async () => {
    const employeeId = `${TEST_PREFIX}${uniqueSuffix()}`;

    const payload = { employeeId, name: "Duplicate", designationId, farmId };

    const first = await request(app)
      .post("/api/employees")
      .set("Cookie", dgm.cookie)
      .send(payload);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/employees")
      .set("Cookie", dgm.cookie)
      .send(payload);

    expect(second.status).toBe(409);
  });

  it("rejects an unknown designation", async () => {
    const response = await request(app)
      .post("/api/employees")
      .set("Cookie", dgm.cookie)
      .send({
        employeeId: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Bad designation",
        designationId: "00000000-0000-0000-0000-000000000000",
        farmId,
      });

    expect(response.status).toBe(404);
  });

  it("rejects an employee for a farm outside the caller's scope", async () => {
    // A FARM-scoped DGM may not create an employee in a farm it does not own.
    const otherFarm = await createTestFarm();

    const response = await request(app)
      .post("/api/employees")
      .set("Cookie", dgm.cookie)
      .send({
        employeeId: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Cross-farm employee",
        designationId,
        farmId: otherFarm.id,
      });

    expect(response.status).toBe(403);
  });

  it("rejects an invalid employee ID parameter", async () => {
    const response = await request(app)
      .get("/api/employees/not-a-uuid")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(400);
  });

  it("updates an employee", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .patch(`/api/employees/${employee.id}`)
      .set("Cookie", dgm.cookie)
      .send({ name: "Renamed Employee" });

    expect(response.status).toBe(200);
    expect(response.body.employee.name).toBe("Renamed Employee");
  });

  it("allows the Incharge role to update an employee", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .patch(`/api/employees/${employee.id}`)
      .set("Cookie", incharge.cookie)
      .send({ name: "Renamed by Incharge" });

    expect(response.status).toBe(200);
    expect(response.body.employee.name).toBe("Renamed by Incharge");
  });

  it("allows the Accounts Assistant role to update an employee", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .patch(`/api/employees/${employee.id}`)
      .set("Cookie", accountsAssistant.cookie)
      .send({ name: "Renamed by Accounts Assistant" });

    expect(response.status).toBe(200);
    expect(response.body.employee.name).toBe("Renamed by Accounts Assistant");
  });

  it("denies the Supervisor role from updating an employee", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .patch(`/api/employees/${employee.id}`)
      .set("Cookie", supervisor.cookie)
      .send({ name: "Renamed by Supervisor" });

    expect(response.status).toBe(403);
  });

  it("does not change status through the generic update endpoint", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .patch(`/api/employees/${employee.id}`)
      .set("Cookie", dgm.cookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body.employee.status).toBe("ACTIVE");
  });

  it("allows the Accountant role to run the employee lifecycle", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const deactivated = await request(app)
      .patch(`/api/employees/${employee.id}/deactivate`)
      .set("Cookie", accountant.cookie);

    expect(deactivated.status).toBe(200);
    expect(deactivated.body.employee.status).toBe("INACTIVE");

    const repeated = await request(app)
      .patch(`/api/employees/${employee.id}/deactivate`)
      .set("Cookie", accountant.cookie);

    expect(repeated.status).toBe(409);

    const reactivated = await request(app)
      .patch(`/api/employees/${employee.id}/reactivate`)
      .set("Cookie", accountant.cookie);

    expect(reactivated.status).toBe(200);
    expect(reactivated.body.employee.status).toBe("ACTIVE");
  });

  it("denies the Supervisor role employee creation", async () => {
    const response = await request(app)
      .post("/api/employees")
      .set("Cookie", supervisor.cookie)
      .send({
        employeeId: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Not allowed",
        designationId,
        farmId,
      });

    expect(response.status).toBe(403);
  });

  it("denies the Supervisor role lifecycle access", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .patch(`/api/employees/${employee.id}/deactivate`)
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(403);
  });

  it("provisions a login for an employee without leaking secrets", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const email = `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`;

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({ email, roleId: supervisorRoleId });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.roles).toEqual(["Supervisor"]);
    // A provisioned account starts in the first-login password-setup state.
    expect(response.body.user.mustSetPassword).toBe(true);
    expect(containsSensitiveFields(response.body)).toBe(false);

    // A second login on the same employee is rejected (one user per employee).
    const repeated = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({
        email: `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`,
        roleId: supervisorRoleId,
      });

    expect(repeated.status).toBe(409);
  });

  it("rejects provisioning for an inactive employee", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { status: "INACTIVE" },
    });

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({
        email: `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`,
        roleId: supervisorRoleId,
      });

    expect(response.status).toBe(409);
  });

  it("rejects provisioning for an employee without a phone", async () => {
    // First login is by phone OTP, so a provisioned account must have a phone.
    const employee = await createTestEmployeeRecord(farmId, { phone: "" });

    await prisma.employee.update({
      where: { id: employee.id },
      data: { phone: null },
    });

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({
        email: `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`,
        roleId: supervisorRoleId,
      });

    expect(response.status).toBe(409);
  });

  it("rejects a duplicate provisioning email", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({
        email: dgm.email,
        roleId: supervisorRoleId,
      });

    expect(response.status).toBe(409);
  });

  it("denies the Supervisor role user provisioning", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", supervisor.cookie)
      .send({
        email: `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`,
        roleId: supervisorRoleId,
      });

    expect(response.status).toBe(403);
  });

  it("allows setting an optional initial password during provisioning", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const email = `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`;

    const provision = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({ email, roleId: supervisorRoleId, password: "validPassword123" });

    expect(provision.status).toBe(201);
    expect(provision.body.user.mustSetPassword).toBe(false);

    const login = await request(app).post("/api/auth/login").send({
      email,
      password: "validPassword123",
    });

    expect(login.status).toBe(200);
    expect(login.body.user.mustSetPassword).toBe(false);
  });

  it("allows DGM to change the login role of an employee", async () => {
    const employee = await createTestEmployeeRecord(farmId);
    const email = `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`;

    await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({ email, roleId: supervisorRoleId });

    const accountantRole = await prisma.role.findUniqueOrThrow({ where: { name: "Accountant" } });
    const patch = await request(app)
      .patch(`/api/employees/${employee.id}/user/role`)
      .set("Cookie", dgm.cookie)
      .send({ roleId: accountantRole.id });

    expect(patch.status).toBe(200);
    expect(patch.body.employee.user.roles[0].name).toBe("Accountant");
  });

  it("denies DGM from escalating employee to Company Admin", async () => {
    const employee = await createTestEmployeeRecord(farmId);
    const email = `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`;

    await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({ email, roleId: supervisorRoleId });

    const companyAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Company Admin" } });
    const patch = await request(app)
      .patch(`/api/employees/${employee.id}/user/role`)
      .set("Cookie", dgm.cookie)
      .send({ roleId: companyAdminRole.id });

    expect(patch.status).toBe(403);
  });

  it("allows DGM to delete an employee", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .delete(`/api/employees/${employee.id}`)
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const found = await prisma.employee.findUnique({
      where: { id: employee.id },
    });
    expect(found).toBeNull();
  });

  it("allows Accountant to delete an employee", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .delete(`/api/employees/${employee.id}`)
      .set("Cookie", accountant.cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const found = await prisma.employee.findUnique({
      where: { id: employee.id },
    });
    expect(found).toBeNull();
  });

  it("denies Supervisor from deleting an employee", async () => {
    const employee = await createTestEmployeeRecord(farmId);

    const response = await request(app)
      .delete(`/api/employees/${employee.id}`)
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(403);

    const found = await prisma.employee.findUnique({
      where: { id: employee.id },
    });
    expect(found).not.toBeNull();
  });

  it("returns 404 when deleting a non-existent employee", async () => {
    const response = await request(app)
      .delete("/api/employees/00000000-0000-0000-0000-000000000000")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(404);
  });

  it("denies an Accountant from deleting a DGM (higher role hierarchy)", async () => {
    const response = await request(app)
      .delete(`/api/employees/${dgm.employeeRowId}`)
      .set("Cookie", accountant.cookie);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/higher role/i);
  });

  it("denies an Accountant from deleting an Assistant Manager (higher role hierarchy)", async () => {
    const asstManager = await createActor("Assistant Manager", { farmId });

    const response = await request(app)
      .delete(`/api/employees/${asstManager.employeeRowId}`)
      .set("Cookie", accountant.cookie);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/higher role/i);
  });

  it("allows an Accountant to delete a Supervisor (lower role hierarchy)", async () => {
    const targetSupervisor = await createActor("Supervisor", { farmId });

    const response = await request(app)
      .delete(`/api/employees/${targetSupervisor.employeeRowId}`)
      .set("Cookie", accountant.cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("denies an actor from deleting their own employee account", async () => {
    const response = await request(app)
      .delete(`/api/employees/${dgm.employeeRowId}`)
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/own account/i);
  });

  it("allows DGM to delete an employee with Accountant role", async () => {
    const targetAccountant = await createActor("Accountant", { farmId });

    const response = await request(app)
      .delete(`/api/employees/${targetAccountant.employeeRowId}`)
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
