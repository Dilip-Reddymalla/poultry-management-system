import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  createActor,
  createTestCompany,
  createTestEmployeeRecord,
  createTestFarm,
  createTestWorker,
  loginSystemAdmin,
  prisma,
  type TestActor,
} from "./helpers.js";
import { haversineDistanceMeters, formatDistance } from "../src/utils/geo.js";
import { evaluateGeofence } from "../src/modules/attendance/attendance.service.js";
import { processAutoAbsentCutoffs } from "../src/modules/attendance/auto-absent.service.js";

describe("Farm Geofence & Auto-Mark Absent", () => {
  let systemAdminCookie: string;
  let supervisor: TestActor;
  let farmId: string;
  let insideEmployeeId: string;
  let outsideEmployeeId: string;
  let unmarkedWorkerId: string;

  // Reference coordinates for farm: Hyderabad center (17.3850, 78.4867)
  const FARM_LAT = 17.3850;
  const FARM_LON = 78.4867;

  beforeAll(async () => {
    await cleanupTestData();

    systemAdminCookie = await loginSystemAdmin();
    const company = await createTestCompany();

    // Create a farm with GPS coordinates and 1,000m (1 KM) default geofence
    const farm = await createTestFarm("ACTIVE", company.id);
    farmId = farm.id;

    // Persist coordinates and geofence radius on farm
    await prisma.farm.update({
      where: { id: farmId },
      data: {
        latitude: FARM_LAT,
        longitude: FARM_LON,
        geofenceRadius: 1000,
      },
    });

    supervisor = await createActor("Supervisor", { farmId });

    insideEmployeeId = (await createTestEmployeeRecord(farmId)).id;
    outsideEmployeeId = (await createTestEmployeeRecord(farmId)).id;
    unmarkedWorkerId = (await createTestWorker(farmId)).id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("Haversine & Geofence Math", () => {
    it("calculates exact distance between points", () => {
      // Zero distance for identical points
      expect(haversineDistanceMeters(FARM_LAT, FARM_LON, FARM_LAT, FARM_LON)).toBe(0);

      // ~1.11 km North (0.01 deg latitude delta)
      const dist = haversineDistanceMeters(FARM_LAT, FARM_LON, FARM_LAT + 0.01, FARM_LON);
      expect(dist).toBeGreaterThan(1100);
      expect(dist).toBeLessThan(1130);

      expect(formatDistance(dist)).toMatch(/1\.1[0-9]km/);
      expect(formatDistance(450)).toBe("450m");
    });

    it("evaluates within vs outside default 1000m geofence", () => {
      const farmLoc = {
        id: "mock-farm-id",
        companyId: "mock-company-id",
        latitude: FARM_LAT,
        longitude: FARM_LON,
        geofenceRadius: 1000,
      };

      // 200m away -> within 1 KM geofence
      const insideGeo = evaluateGeofence(FARM_LAT + 0.0018, FARM_LON, farmLoc);
      expect(insideGeo.isExceeded).toBe(false);
      expect(insideGeo.flagNote).toBeNull();

      // 3.5 km away -> exceeds 1 KM geofence
      const outsideGeo = evaluateGeofence(FARM_LAT + 0.0315, FARM_LON, farmLoc);
      expect(outsideGeo.isExceeded).toBe(true);
      expect(outsideGeo.flagNote).toContain("Location offset:");
      expect(outsideGeo.flagNote).toContain("Geofence: 1.00km");
    });
  });

  describe("Attendance Recording with Geofence Evaluation", () => {
    it("approves attendance automatically when inside 1 KM geofence", async () => {
      const res = await request(app)
        .post("/api/attendance")
        .set("Cookie", supervisor.cookie)
        .send({
          employeeId: insideEmployeeId,
          date: "2026-06-01",
          shift: "MORNING_SHIFT",
          status: "PRESENT",
          latitude: FARM_LAT + 0.002, // ~220 meters away
          longitude: FARM_LON,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.attendance.locationSource).toBe("GPS_EXACT");
      expect(res.body.attendance.approvedAt).not.toBeNull();
    });

    it("flags attendance for Pending Approval when beyond 1 KM geofence", async () => {
      const res = await request(app)
        .post("/api/attendance")
        .set("Cookie", supervisor.cookie)
        .send({
          employeeId: outsideEmployeeId,
          date: "2026-06-01",
          shift: "MORNING_SHIFT",
          status: "PRESENT",
          latitude: FARM_LAT + 0.035, // ~3.8 km away
          longitude: FARM_LON,
          notes: "Field visit",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Routed to pending approval queue
      expect(res.body.attendance.locationSource).toBe("GEOFENCE_EXCEEDED");
      expect(res.body.attendance.approvedAt).toBeNull();
      expect(res.body.attendance.approvedBy).toBeNull();
      expect(res.body.attendance.notes).toContain("Field visit [Location offset:");
    });
  });

  describe("Auto-Absent Cutoffs & Pending Approval Exclusion", () => {
    it("does not mark pending approval submissions as absent, only unmarked personnel", async () => {
      // Simulate shift cutoff after Morning Shift has ended (e.g. 14:00 reference time)
      const cutoffTime = new Date("2026-06-01T14:00:00.000Z");
      // Set hours and minutes to 14:00
      cutoffTime.setHours(14, 0, 0, 0);

      const summary = await processAutoAbsentCutoffs(cutoffTime);
      expect(summary.farmsEvaluated).toBeGreaterThanOrEqual(1);

      // Verify database attendance for 2026-06-01 and MORNING_SHIFT
      const records = await prisma.attendance.findMany({
        where: {
          farmId,
          date: new Date("2026-06-01T00:00:00.000Z"),
          shift: "MORNING_SHIFT",
        },
      });

      // 1. Inside employee was marked PRESENT and approved -> STILL PRESENT
      const insideRecord = records.find((r) => r.employeeId === insideEmployeeId);
      expect(insideRecord?.status).toBe("PRESENT");

      // 2. Outside employee is WAITING FOR APPROVAL -> MUST NOT BE MARKED ABSENT
      const outsideRecord = records.find((r) => r.employeeId === outsideEmployeeId);
      expect(outsideRecord?.status).toBe("PRESENT");
      expect(outsideRecord?.locationSource).toBe("GEOFENCE_EXCEEDED");
      expect(outsideRecord?.approvedAt).toBeNull();

      // 3. Unmarked worker was never recorded -> MUST BE AUTO-MARKED ABSENT
      const unmarkedRecord = records.find((r) => r.workerId === unmarkedWorkerId);
      expect(unmarkedRecord).toBeDefined();
      expect(unmarkedRecord?.status).toBe("ABSENT");
      expect(unmarkedRecord?.notes).toContain("Auto-marked absent (Shift cutoff + 5m grace)");
    });

    it("never auto-marks absent for NIGHT_SHIFT or OVERTIME", async () => {
      // Check that NIGHT_SHIFT was not created as ABSENT for unmarked personnel
      const nightRecords = await prisma.attendance.findMany({
        where: {
          farmId,
          date: new Date("2026-06-01T00:00:00.000Z"),
          shift: "NIGHT_SHIFT",
        },
      });
      expect(nightRecords.length).toBe(0);
    });

    it("triggers via POST /api/attendance/auto-absent-check endpoint", async () => {
      const res = await request(app)
        .post("/api/attendance/auto-absent-check")
        .set("Cookie", supervisor.cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("totalMarkedAbsent");
    });
  });
});
