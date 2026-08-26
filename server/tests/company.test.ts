import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  containsSensitiveFields,
  createActor,
  createTestCompany,
  createTestFarm,
  loginSystemAdmin,
  prisma,
  TEST_PREFIX,
  uniqueSuffix,
  type TestActor,
} from "./helpers.js";

describe("company module", () => {
  let systemAdminCookie: string;
  let companyAdmin: TestActor;
  let supervisor: TestActor;
  let companyAId: string;
  let companyBId: string;

  beforeAll(async () => {
    await cleanupTestData();

    const companyA = await createTestCompany();
    const companyB = await createTestCompany();
    const farmA = await createTestFarm("ACTIVE", companyA.id);

    companyAId = companyA.id;
    companyBId = companyB.id;

    systemAdminCookie = await loginSystemAdmin();
    companyAdmin = await createActor("Company Admin", { farmId: farmA.id });
    supervisor = await createActor("Supervisor");
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/companies");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("lets the System Admin list every company", async () => {
    const response = await request(app)
      .get("/api/companies")
      .set("Cookie", systemAdminCookie);

    expect(response.status).toBe(200);

    const ids = response.body.companies.map((c: { id: string }) => c.id);

    expect(ids).toContain(companyAId);
    expect(ids).toContain(companyBId);
    expect(containsSensitiveFields(response.body)).toBe(false);
  });

  it("exposes only the safe company shape", async () => {
    const response = await request(app)
      .get(`/api/companies/${companyAId}`)
      .set("Cookie", systemAdminCookie);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.company).sort()).toEqual([
      "code",
      "farmCount",
      "id",
      "name",
    ]);
    // companyA owns exactly the one farm created for the Company Admin.
    expect(response.body.company.farmCount).toBe(1);
  });

  it("lets the System Admin create a company", async () => {
    const code = `${TEST_PREFIX}${uniqueSuffix()}`;

    const response = await request(app)
      .post("/api/companies")
      .set("Cookie", systemAdminCookie)
      .send({ name: "Created Company", code });

    expect(response.status).toBe(201);
    expect(response.body.company.code).toBe(code);
    expect(response.body.company.farmCount).toBe(0);
  });

  it("rejects a duplicate company code", async () => {
    const payload = { name: "Dup Company", code: `${TEST_PREFIX}${uniqueSuffix()}` };

    const first = await request(app)
      .post("/api/companies")
      .set("Cookie", systemAdminCookie)
      .send(payload);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/companies")
      .set("Cookie", systemAdminCookie)
      .send(payload);

    expect(second.status).toBe(409);
  });

  it("scopes the company list to the caller's own company", async () => {
    const response = await request(app)
      .get("/api/companies")
      .set("Cookie", companyAdmin.cookie);

    expect(response.status).toBe(200);
    expect(response.body.companies).toHaveLength(1);
    expect(response.body.companies[0].id).toBe(companyAId);
  });

  it("lets a Company Admin read its own company", async () => {
    const response = await request(app)
      .get(`/api/companies/${companyAId}`)
      .set("Cookie", companyAdmin.cookie);

    expect(response.status).toBe(200);
    expect(response.body.company.id).toBe(companyAId);
  });

  it("hides another company as not found (no cross-company leak)", async () => {
    const response = await request(app)
      .get(`/api/companies/${companyBId}`)
      .set("Cookie", companyAdmin.cookie);

    expect(response.status).toBe(404);
  });

  it("lets a Company Admin update its own company", async () => {
    const response = await request(app)
      .patch(`/api/companies/${companyAId}`)
      .set("Cookie", companyAdmin.cookie)
      .send({ name: "Renamed Company A" });

    expect(response.status).toBe(200);
    expect(response.body.company.name).toBe("Renamed Company A");
  });

  it("denies updating another company", async () => {
    const response = await request(app)
      .patch(`/api/companies/${companyBId}`)
      .set("Cookie", companyAdmin.cookie)
      .send({ name: "Cross-company rename" });

    expect(response.status).toBe(403);
  });

  it("denies company creation to a Company Admin (global action)", async () => {
    const response = await request(app)
      .post("/api/companies")
      .set("Cookie", companyAdmin.cookie)
      .send({ name: "Not allowed", code: `${TEST_PREFIX}${uniqueSuffix()}` });

    expect(response.status).toBe(403);
  });

  it("denies company:view to a Supervisor", async () => {
    const response = await request(app)
      .get("/api/companies")
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(403);
  });

  it("lets the System Admin update any company", async () => {
    const response = await request(app)
      .patch(`/api/companies/${companyBId}`)
      .set("Cookie", systemAdminCookie)
      .send({ name: "Admin Renamed B" });

    expect(response.status).toBe(200);
    expect(response.body.company.name).toBe("Admin Renamed B");
  });
});
