import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  createActor,
  createTestCompany,
  createTestFarm,
  prisma,
  TEST_PREFIX,
  uniqueSuffix,
  type TestActor,
} from "./helpers.js";

describe("farm write operations", () => {
  // A Company Admin is COMPANY-scoped: it owns the full farm lifecycle, but only
  // within its own company. A Supervisor (no farm:create/lifecycle) covers the
  // permission denials, and a second company covers cross-company scope denial.
  let companyAdmin: TestActor;
  let supervisor: TestActor;
  let companyId: string;
  let homeFarmId: string;

  beforeAll(async () => {
    await cleanupTestData();

    const company = await createTestCompany();
    const homeFarm = await createTestFarm("ACTIVE", company.id);

    companyId = company.id;
    homeFarmId = homeFarm.id;

    companyAdmin = await createActor("Company Admin", { farmId: homeFarm.id });
    supervisor = await createActor("Supervisor");
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("creates a farm inside the caller's own company", async () => {
    const code = `${TEST_PREFIX}${uniqueSuffix()}`;

    const response = await request(app)
      .post("/api/farms")
      .set("Cookie", companyAdmin.cookie)
      .send({ companyId, code, name: "Created Farm" });

    expect(response.status).toBe(201);
    expect(response.body.farm.code).toBe(code);
    expect(response.body.farm.status).toBe("ACTIVE");
    expect(response.body.farm.company.id).toBe(companyId);
  });

  it("denies farm creation to the Supervisor role", async () => {
    const response = await request(app)
      .post("/api/farms")
      .set("Cookie", supervisor.cookie)
      .send({
        companyId,
        code: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Not allowed",
      });

    expect(response.status).toBe(403);
  });

  it("denies creating a farm in another company", async () => {
    const otherCompany = await createTestCompany();

    const response = await request(app)
      .post("/api/farms")
      .set("Cookie", companyAdmin.cookie)
      .send({
        companyId: otherCompany.id,
        code: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Cross-company Farm",
      });

    expect(response.status).toBe(403);
  });

  it("rejects a farm for an unknown company", async () => {
    const response = await request(app)
      .post("/api/farms")
      .set("Cookie", companyAdmin.cookie)
      .send({
        companyId: "00000000-0000-0000-0000-000000000000",
        code: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Orphan Farm",
      });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid company ID", async () => {
    const response = await request(app)
      .post("/api/farms")
      .set("Cookie", companyAdmin.cookie)
      .send({
        companyId: "not-a-uuid",
        code: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Invalid Farm",
      });

    expect(response.status).toBe(400);
  });

  it("rejects a duplicate farm code within the same company", async () => {
    const payload = {
      companyId,
      code: `${TEST_PREFIX}${uniqueSuffix()}`,
      name: "Duplicate Farm",
    };

    const first = await request(app)
      .post("/api/farms")
      .set("Cookie", companyAdmin.cookie)
      .send(payload);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/farms")
      .set("Cookie", companyAdmin.cookie)
      .send(payload);

    expect(second.status).toBe(409);
  });

  it("updates a farm", async () => {
    const farm = await createTestFarm("ACTIVE", companyId);

    const response = await request(app)
      .patch(`/api/farms/${farm.id}`)
      .set("Cookie", companyAdmin.cookie)
      .send({ name: "Renamed Farm" });

    expect(response.status).toBe(200);
    expect(response.body.farm.name).toBe("Renamed Farm");
  });

  it("does not change status or company through the generic update endpoint", async () => {
    const farm = await createTestFarm("ACTIVE", companyId);

    const response = await request(app)
      .patch(`/api/farms/${farm.id}`)
      .set("Cookie", companyAdmin.cookie)
      .send({
        status: "INACTIVE",
        companyId: "00000000-0000-0000-0000-000000000000",
      });

    expect(response.status).toBe(200);
    expect(response.body.farm.status).toBe("ACTIVE");
    expect(response.body.farm.company.id).toBe(companyId);
  });

  it("returns 404 when updating an unknown farm", async () => {
    const response = await request(app)
      .patch("/api/farms/00000000-0000-0000-0000-000000000000")
      .set("Cookie", companyAdmin.cookie)
      .send({ name: "Missing Farm" });

    expect(response.status).toBe(404);
  });

  it("denies updating a farm in another company", async () => {
    // Out-of-scope farms exist but are unreachable: an update into another company
    // is a write denial (403), not a not-found.
    const otherCompany = await createTestCompany();
    const otherFarm = await createTestFarm("ACTIVE", otherCompany.id);

    const response = await request(app)
      .patch(`/api/farms/${otherFarm.id}`)
      .set("Cookie", companyAdmin.cookie)
      .send({ name: "Cross-company rename" });

    expect(response.status).toBe(403);
  });

  it("runs the farm lifecycle for the Company Admin role", async () => {
    const farm = await createTestFarm("ACTIVE", companyId);

    const deactivated = await request(app)
      .patch(`/api/farms/${farm.id}/deactivate`)
      .set("Cookie", companyAdmin.cookie);

    expect(deactivated.status).toBe(200);
    expect(deactivated.body.farm.status).toBe("INACTIVE");

    const repeated = await request(app)
      .patch(`/api/farms/${farm.id}/deactivate`)
      .set("Cookie", companyAdmin.cookie);

    expect(repeated.status).toBe(409);

    const reactivated = await request(app)
      .patch(`/api/farms/${farm.id}/reactivate`)
      .set("Cookie", companyAdmin.cookie);

    expect(reactivated.status).toBe(200);
    expect(reactivated.body.farm.status).toBe("ACTIVE");
  });

  it("denies the farm lifecycle to the Supervisor role", async () => {
    const farm = await createTestFarm("ACTIVE", companyId);

    const response = await request(app)
      .patch(`/api/farms/${farm.id}/deactivate`)
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(403);
  });

  it("allows the Supervisor role to read farms", async () => {
    // Referenced so the shared home farm is always used by at least one case and
    // the fixture reads as intentional.
    expect(homeFarmId).toBeDefined();

    const response = await request(app)
      .get("/api/farms")
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.farms)).toBe(true);
  });
});
