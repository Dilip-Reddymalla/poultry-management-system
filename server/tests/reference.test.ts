import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  containsSensitiveFields,
  createActor,
  prisma,
  type TestActor,
} from "./helpers.js";

describe("reference data endpoints", () => {
  let dgm: TestActor;
  let supervisor: TestActor;

  beforeAll(async () => {
    await cleanupTestData();

    dgm = await createActor("DGM");
    // Supervisor has employee:view but not user:create, so it exercises both the
    // allowed side (designations) and the denied side (roles) of the same fixture.
    supervisor = await createActor("Supervisor");
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("requires authentication for every reference list", async () => {
    for (const path of ["/api/designations", "/api/roles"]) {
      const response = await request(app).get(path);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    }
  });

  it("returns designations as a simple sorted list", async () => {
    const response = await request(app)
      .get("/api/designations")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.designations)).toBe(true);
    expect(response.body.pagination).toBeUndefined();

    const names = response.body.designations.map(
      (designation: { name: string }) => designation.name,
    );

    expect(names).toContain("Worker");
    expect([...names].sort()).toEqual(names);

    expect(Object.keys(response.body.designations[0]).sort()).toEqual([
      "id",
      "name",
    ]);
  });

  it("returns roles with their descriptions", async () => {
    const response = await request(app)
      .get("/api/roles")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);

    const dgmRole = response.body.roles.find(
      (role: { name: string }) => role.name === "DGM",
    );

    expect(dgmRole).toBeDefined();
    expect(Object.keys(dgmRole).sort()).toEqual([
      "description",
      "id",
      "name",
    ]);
    expect(containsSensitiveFields(response.body)).toBe(false);
  });

  it("allows designations for the Supervisor role (has employee:view)", async () => {
    const response = await request(app)
      .get("/api/designations")
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.designations)).toBe(true);
  });

  it("denies roles without user:create", async () => {
    const response = await request(app)
      .get("/api/roles")
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(403);
  });
});
