import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  containsSensitiveFields,
  createActor,
  createTestEmployeeRecord,
  getDesignationId,
  prisma,
  TEST_EMAIL_DOMAIN,
  TEST_PREFIX,
  uniqueSuffix,
  type TestActor,
} from "./helpers.js";

describe("employee module", () => {
  let dgm: TestActor;
  let accountant: TestActor;
  let supervisor: TestActor;
  let designationId: string;
  let supervisorRoleId: string;

  beforeAll(async () => {
    await cleanupTestData();

    dgm = await createActor("DGM");
    accountant = await createActor("Accountant");
    supervisor = await createActor("Supervisor");

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
      .send({ employeeId, name: "Created Employee", designationId });

    expect(response.status).toBe(201);
    expect(response.body.employee.employeeId).toBe(employeeId);
    expect(response.body.employee.hasUser).toBe(false);
    expect(containsSensitiveFields(response.body)).toBe(false);
  });

  it("rejects a duplicate employee ID", async () => {
    const employeeId = `${TEST_PREFIX}${uniqueSuffix()}`;

    const payload = { employeeId, name: "Duplicate", designationId };

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
      });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid employee ID parameter", async () => {
    const response = await request(app)
      .get("/api/employees/not-a-uuid")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(400);
  });

  it("updates an employee", async () => {
    const employee = await createTestEmployeeRecord();

    const response = await request(app)
      .patch(`/api/employees/${employee.id}`)
      .set("Cookie", dgm.cookie)
      .send({ name: "Renamed Employee" });

    expect(response.status).toBe(200);
    expect(response.body.employee.name).toBe("Renamed Employee");
  });

  it("does not change status through the generic update endpoint", async () => {
    const employee = await createTestEmployeeRecord();

    const response = await request(app)
      .patch(`/api/employees/${employee.id}`)
      .set("Cookie", dgm.cookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body.employee.status).toBe("ACTIVE");
  });

  it("allows the Accountant role to run the employee lifecycle", async () => {
    const employee = await createTestEmployeeRecord();

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

  it("denies the Accountant role employee creation", async () => {
    const response = await request(app)
      .post("/api/employees")
      .set("Cookie", accountant.cookie)
      .send({
        employeeId: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Not allowed",
        designationId,
      });

    expect(response.status).toBe(403);
  });

  it("denies the Supervisor role lifecycle access", async () => {
    const employee = await createTestEmployeeRecord();

    const response = await request(app)
      .patch(`/api/employees/${employee.id}/deactivate`)
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(403);
  });

  it("provisions a login for an employee without leaking secrets", async () => {
    const employee = await createTestEmployeeRecord();

    const email = `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`;

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({ email, password: "provisioned-password", roleId: supervisorRoleId });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.roles).toEqual(["Supervisor"]);
    expect(containsSensitiveFields(response.body)).toBe(false);

    const repeated = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({
        email: `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`,
        password: "provisioned-password",
        roleId: supervisorRoleId,
      });

    expect(repeated.status).toBe(409);
  });

  it("rejects provisioning for an inactive employee", async () => {
    const employee = await createTestEmployeeRecord();

    await prisma.employee.update({
      where: { id: employee.id },
      data: { status: "INACTIVE" },
    });

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({
        email: `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`,
        password: "provisioned-password",
        roleId: supervisorRoleId,
      });

    expect(response.status).toBe(409);
  });

  it("rejects a duplicate provisioning email", async () => {
    const employee = await createTestEmployeeRecord();

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({
        email: dgm.email,
        password: "provisioned-password",
        roleId: supervisorRoleId,
      });

    expect(response.status).toBe(409);
  });

  it("denies the Supervisor role user provisioning", async () => {
    const employee = await createTestEmployeeRecord();

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", supervisor.cookie)
      .send({
        email: `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`,
        password: "provisioned-password",
        roleId: supervisorRoleId,
      });

    expect(response.status).toBe(403);
  });
});
