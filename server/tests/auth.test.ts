import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  containsSensitiveFields,
  createActor,
  prisma,
  TEST_PASSWORD,
  type TestActor,
} from "./helpers.js";

describe("auth and RBAC", () => {
  let dgm: TestActor;
  let supervisor: TestActor;

  beforeAll(async () => {
    await cleanupTestData();

    dgm = await createActor("DGM");
    supervisor = await createActor("Supervisor");
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("exposes an unauthenticated health check", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("rejects a request with no cookie", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  it("rejects a request with an invalid cookie", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", "poultry_auth=not-a-real-token");

    expect(response.status).toBe(401);
  });

  it("returns the current user without sensitive fields", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);
    expect(response.body.user.employeeId).toBe(dgm.employeeId);
    expect(containsSensitiveFields(response.body)).toBe(false);
  });

  it("does not leak sensitive fields on login", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: dgm.email,
      password: TEST_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(containsSensitiveFields(response.body)).toBe(false);
  });

  it("rejects a wrong password with a generic message", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: dgm.email,
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("invalidates an existing session when the employee is deactivated", async () => {
    await prisma.employee.update({
      where: { id: supervisor.employeeRowId },
      data: { status: "INACTIVE" },
    });

    const deactivated = await request(app)
      .get("/api/auth/me")
      .set("Cookie", supervisor.cookie);

    expect(deactivated.status).toBe(401);

    await prisma.employee.update({
      where: { id: supervisor.employeeRowId },
      data: { status: "ACTIVE" },
    });

    const reactivated = await request(app)
      .get("/api/auth/me")
      .set("Cookie", supervisor.cookie);

    expect(reactivated.status).toBe(200);
  });

  it("never modifies User.isActive during the employee lifecycle", async () => {
    const user = await prisma.user.findUnique({
      where: { id: supervisor.userId },
      select: { isActive: true },
    });

    expect(user?.isActive).toBe(true);
  });

  it("denies an endpoint the role has no permission for", async () => {
    const response = await request(app)
      .post("/api/employees")
      .set("Cookie", supervisor.cookie)
      .send({
        employeeId: "TMP-TEST-forbidden",
        name: "Should not be created",
        designationId: "00000000-0000-0000-0000-000000000000",
      });

    expect(response.status).toBe(403);
  });

  it("ignores roles and permissions supplied in the request body", async () => {
    const response = await request(app)
      .post("/api/employees")
      .set("Cookie", supervisor.cookie)
      .send({
        employeeId: "TMP-TEST-forged",
        name: "Forged authority",
        designationId: "00000000-0000-0000-0000-000000000000",
        roles: ["DGM"],
        permissions: ["employee:create"],
      });

    expect(response.status).toBe(403);
  });

  it("allows an endpoint the role does have permission for", async () => {
    const response = await request(app)
      .get("/api/employees")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);
    expect(containsSensitiveFields(response.body)).toBe(false);
  });
});
