import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";

import {
  app,
  cleanupTestData,
  createActor,
  createTestCompany,
  createTestFarm,
  prisma,
  type TestActor,
} from "./helpers.js";

describe("Cross-Enterprise Attendance Report", () => {
  let company1Admin: TestActor;
  let company2Admin: TestActor;
  let c1Farm1Id: string;
  let c1Farm2Id: string;
  let c2FarmId: string;
  let company1Id: string;
  let company2Id: string;

  beforeAll(async () => {
    // Set up Company 1 with 2 Farms
    const company1 = await createTestCompany();
    company1Id = company1.id;
    const farm1 = await createTestFarm("ACTIVE", company1Id);
    const farm2 = await createTestFarm("ACTIVE", company1Id);
    c1Farm1Id = farm1.id;
    c1Farm2Id = farm2.id;

    // Set up Company 2 with 1 Farm
    const company2 = await createTestCompany();
    company2Id = company2.id;
    const farm3 = await createTestFarm("ACTIVE", company2Id);
    c2FarmId = farm3.id;

    company1Admin = await createActor("Company Admin", { farmId: c1Farm1Id });
    company2Admin = await createActor("Company Admin", { farmId: c2FarmId });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("returns report scoped exclusively to Company 1 farms for Company 1 Admin", async () => {
    const res = await request(app)
      .get("/api/attendance/reports/summary")
      .set("Cookie", company1Admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overview).toBeDefined();

    const farmIds = res.body.data.farms.map((f: any) => f.farmId);
    expect(farmIds).toContain(c1Farm1Id);
    expect(farmIds).toContain(c1Farm2Id);
    expect(farmIds).not.toContain(c2FarmId);

    // Cross-farm comparison is included when >= 2 farms exist
    expect(res.body.data.farmComparison).toBeDefined();
    expect(Array.isArray(res.body.data.farmComparison)).toBe(true);
    expect(res.body.data.farmComparison.length).toBe(2);
    expect(res.body.data.farmComparison[0].rank).toBe(1);
    expect(res.body.data.farmComparison[0].isBest).toBe(true);
  });

  it("filters by farmId within the company", async () => {
    const res = await request(app)
      .get(`/api/attendance/reports/summary?farmId=${c1Farm1Id}`)
      .set("Cookie", company1Admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.farms.length).toBe(1);
    expect(res.body.data.farms[0].farmId).toBe(c1Farm1Id);
  });

  it("denies access to farm-scoped supervisor", async () => {
    const supervisor = await createActor("Supervisor", { farmId: c1Farm1Id });
    const res = await request(app)
      .get("/api/attendance/reports/summary")
      .set("Cookie", supervisor.cookie);

    // Supervisor has attendance:view but not report:view, or blocked by scope check
    expect([403, 401]).toContain(res.status);
  });
});
