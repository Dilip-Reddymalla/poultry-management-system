import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  containsSensitiveFields,
  createActor,
  createTestEmployeeRecord,
  prisma,
  TEST_EMAIL_DOMAIN,
  uniqueSuffix,
  type TestActor,
} from "./helpers.js";

// Regression cover for the API contract pieces the frontend depends on:
// the JSON 404 fallback, the validation error envelope, and the SafeUser shape
// (designation as an object, resolved permissions, no leaked secrets).
describe("API contract", () => {
  let dgm: TestActor;
  let supervisorRoleId: string;

  beforeAll(async () => {
    await cleanupTestData();

    dgm = await createActor("DGM");

    const supervisorRole = await prisma.role.findUniqueOrThrow({
      where: {
        name: "Supervisor",
      },
      select: {
        id: true,
      },
    });

    supervisorRoleId = supervisorRole.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("returns a JSON envelope for the health check", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.message).toBe("string");
  });

  it("returns a JSON 404 for an unknown route instead of HTML", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({
      success: false,
      message: "Route not found",
    });
  });

  it("exposes both fieldErrors and formErrors on a validation failure", async () => {
    const response = await request(app).post("/api/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
    expect(Array.isArray(response.body.errors.email)).toBe(true);
    expect(Array.isArray(response.body.errors.password)).toBe(true);
    expect(Array.isArray(response.body.formErrors)).toBe(true);
  });

  it("returns resolved permissions and a designation object from /auth/me", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);

    const user = response.body.user;

    expect(user.roles).toContain("DGM");
    expect(Array.isArray(user.permissions)).toBe(true);
    expect(user.permissions).toContain("employee:view");
    expect(user.employee.designation.name).toBe("Worker");
    expect(typeof user.employee.designation.id).toBe("string");
    expect(containsSensitiveFields(response.body)).toBe(false);
    // The misspelled Prisma field name must never reach the frontend.
    expect(JSON.stringify(response.body)).not.toContain("desigination");
  });

  it("returns the same user shape from login as from /auth/me", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: dgm.email,
      password: "test-password-123",
    });

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Cookie", dgm.cookie);

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user).toEqual(meResponse.body.user);
  });

  it("returns permissions and a designation object when provisioning a user", async () => {
    const employee = await createTestEmployeeRecord(dgm.farmId);

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({
        email: `tmp-test-provision-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`,
        roleId: supervisorRoleId,
      });

    expect(response.status).toBe(201);
    expect(response.body.user.roles).toEqual(["Supervisor"]);
    expect(Array.isArray(response.body.user.permissions)).toBe(true);
    expect(response.body.user.permissions.length).toBeGreaterThan(0);
    expect(typeof response.body.user.employee.designation.id).toBe("string");
    expect(response.body.user.employee.designation.name).toBe("Worker");
    expect(containsSensitiveFields(response.body)).toBe(false);
  });
});
