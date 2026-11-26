import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { prisma } from "../src/config/database.js";
import {
  cleanupTestData,
  createTestEmployeeRecord,
  createTestFarm,
  createTestWorker,
  loginSystemAdmin,
  uniqueSuffix,
} from "./helpers.js";

describe("POST /api/sync/attendance (multi-device offline sync)", () => {
  let cookie = "";
  let farmId = "";
  let employeeId = "";
  let workerId = "";
  const date = "2026-01-15T00:00:00.000Z";
  const shift = "MORNING_SHIFT";

  beforeAll(async () => {
    cookie = await loginSystemAdmin();
    const farm = await createTestFarm();
    farmId = farm.id;
    const emp = await createTestEmployeeRecord(farmId);
    employeeId = emp.id;
    const wrk = await createTestWorker(farmId);
    workerId = wrk.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  function singleItem(itemId: string) {
    return {
      itemId,
      kind: "single" as const,
      data: {
        date,
        shift,
        status: "PRESENT",
        latitude: 17.4,
        longitude: 78.4,
        locationSource: "GPS_EXACT",
        employeeId,
      },
    };
  }

  function faceItem(itemId: string) {
    return {
      itemId,
      kind: "face" as const,
      data: {
        date,
        shift: "AFTERNOON_SHIFT",
        status: "PRESENT",
        latitude: 17.4,
        longitude: 78.4,
        locationSource: "GPS_EXACT",
        workerId,
        livenessScore: 0.97,
        confidenceScore: 0.68,
        qualityScore: 0.5,
      },
    };
  }

  it("rejects an empty items array with 400", async () => {
    const res = await request(app)
      .post("/api/sync/attendance")
      .set("Cookie", cookie)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it("fulfills single and face items for the system admin", async () => {
    const res = await request(app)
      .post("/api/sync/attendance")
      .set("Cookie", cookie)
      .send({ items: [singleItem("t-single-1"), faceItem("t-face-1")] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const byId = new Map(
      res.body.results.map((r: any) => [r.itemId, r.status]),
    );
    expect(byId.get("t-single-1")).toBe("fulfilled");
    expect(byId.get("t-face-1")).toBe("fulfilled");
  });

  it("reports duplicate resubmission as rejected (system already has the record)", async () => {
    // Same unique (date/shift/person) key → should be rejected as already recorded.
    const res = await request(app)
      .post("/api/sync/attendance")
      .set("Cookie", cookie)
      .send({ items: [singleItem("t-single-dup")] });

    expect(res.status).toBe(200);
    const result = res.body.results[0];
    expect(result.status).toBe("rejected");
    expect(result.reason).toMatch(/already recorded|duplicate/i);
  });

  it("is idempotent per syncRef (retried offline submission does not duplicate)", async () => {
    const item = {
      itemId: "t-idem-1",
      kind: "single" as const,
      data: {
        date,
        shift: "NIGHT_SHIFT",
        status: "PRESENT",
        latitude: 17.4,
        longitude: 78.4,
        locationSource: "GPS_EXACT",
        employeeId,
        syncRef: "t-idem-1",
      },
    };

    const first = await request(app)
      .post("/api/sync/attendance")
      .set("Cookie", cookie)
      .send({ items: [item] });
    expect(first.body.results[0].status).toBe("fulfilled");

    // Identical syncRef replay → fulfilled, not a duplicate/500.
    const second = await request(app)
      .post("/api/sync/attendance")
      .set("Cookie", cookie)
      .send({ items: [item] });
    expect(second.body.results[0].status).toBe("fulfilled");
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/sync/attendance")
      .send({ items: [singleItem("t-anon")] });
    expect(res.status).toBe(401);
  });

  it("rejects malformed items", async () => {
    const res = await request(app)
      .post("/api/sync/attendance")
      .set("Cookie", cookie)
      .send({ items: [{ itemId: "", kind: "nope", data: {} }] });
    expect(res.status).toBe(400);
  });

  // Sanity: the fixture IDs were actually created.
  it("created test fixtures", () => {
    expect(farmId).toBeTruthy();
    expect(employeeId).toBeTruthy();
    expect(workerId).toBeTruthy();
    expect(uniqueSuffix()).toBeTruthy();
  });
});
