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

describe("Farm-specific Shift Timings and Roles", () => {
  let companyAdmin: TestActor;
  let farm1Id: string;
  let farm2Id: string;
  let companyId: string;

  beforeAll(async () => {
    const company = await createTestCompany();
    companyId = company.id;

    const farm1 = await createTestFarm("ACTIVE", companyId);
    const farm2 = await createTestFarm("ACTIVE", companyId);

    farm1Id = farm1.id;
    farm2Id = farm2.id;

    companyAdmin = await createActor("Company Admin", { farmId: farm1Id });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe("Shift Timings Management", () => {
    it("fetches default shift timings for a farm", async () => {
      const res = await request(app)
        .get(`/api/farms/${farm1Id}/shift-timings`)
        .set("Cookie", companyAdmin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.shifts.length).toBe(4);

      const morning = res.body.shifts.find((s: any) => s.shift === "MORNING_SHIFT");
      expect(morning).toBeDefined();
      expect(morning.source).toBe("DEFAULT");
    });

    it("customizes farm shift timing and verifies override", async () => {
      const res = await request(app)
        .put(`/api/farms/${farm1Id}/shift-timings/MORNING_SHIFT`)
        .set("Cookie", companyAdmin.cookie)
        .send({
          label: "Early Bird Morning",
          startHour: 6,
          startMinute: 0,
          endHour: 11,
          endMinute: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.timing.label).toBe("Early Bird Morning");
      expect(res.body.timing.source).toBe("FARM");
      expect(res.body.timing.timeRange).toBe("06:00 AM – 11:30 AM");

      // Verify that Farm 2 still inherits default
      const resFarm2 = await request(app)
        .get(`/api/farms/${farm2Id}/shift-timings`)
        .set("Cookie", companyAdmin.cookie);

      const morningFarm2 = resFarm2.body.shifts.find((s: any) => s.shift === "MORNING_SHIFT");
      expect(morningFarm2.source).toBe("DEFAULT");
      expect(morningFarm2.label).toBe("Morning Shift");
    });

    it("resets farm shift timing to default", async () => {
      const res = await request(app)
        .delete(`/api/farms/${farm1Id}/shift-timings/MORNING_SHIFT`)
        .set("Cookie", companyAdmin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.timing.source).toBe("DEFAULT");
      expect(res.body.timing.label).toBe("Morning Shift");
    });
  });

  describe("Roles Configuration and Custom Roles", () => {
    let supervisorRoleId: string;

    it("fetches roles configuration for a farm", async () => {
      const res = await request(app)
        .get(`/api/farms/${farm1Id}/roles-config`)
        .set("Cookie", companyAdmin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.systemRoles.length).toBeGreaterThan(0);

      const supervisor = res.body.systemRoles.find((r: any) => r.name === "Supervisor");
      expect(supervisor).toBeDefined();
      expect(supervisor.isEnabled).toBe(true);
      supervisorRoleId = supervisor.id;
    });

    it("toggles a system role off on Farm 1 and verifies filtering", async () => {
      // Toggle off Supervisor on Farm 1
      const toggleRes = await request(app)
        .patch(`/api/farms/${farm1Id}/roles/${supervisorRoleId}/toggle`)
        .set("Cookie", companyAdmin.cookie)
        .send({ isEnabled: false });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.isEnabled).toBe(false);

      // Verify reference list for Farm 1 excludes Supervisor
      const refResFarm1 = await request(app)
        .get(`/api/reference/roles?farmId=${farm1Id}`)
        .set("Cookie", companyAdmin.cookie);

      expect(refResFarm1.status).toBe(200);
      const namesFarm1 = refResFarm1.body.roles.map((r: any) => r.name);
      expect(namesFarm1).not.toContain("Supervisor");

      // Verify Farm 2 still has Supervisor enabled
      const refResFarm2 = await request(app)
        .get(`/api/reference/roles?farmId=${farm2Id}`)
        .set("Cookie", companyAdmin.cookie);

      const namesFarm2 = refResFarm2.body.roles.map((r: any) => r.name);
      expect(namesFarm2).toContain("Supervisor");

      // Toggle back on
      await request(app)
        .patch(`/api/farms/${farm1Id}/roles/${supervisorRoleId}/toggle`)
        .set("Cookie", companyAdmin.cookie)
        .send({ isEnabled: true });
    });

    it("creates a custom role on Farm 1", async () => {
      const permsRes = await request(app)
        .get("/api/reference/permissions")
        .set("Cookie", companyAdmin.cookie);

      expect(permsRes.status).toBe(200);
      const permIds = permsRes.body.permissions.slice(0, 3).map((p: any) => p.id);

      const createRes = await request(app)
        .post(`/api/farms/${farm1Id}/roles`)
        .set("Cookie", companyAdmin.cookie)
        .send({
          name: "Poultry Health Specialist",
          description: "Oversees flock vaccination and wellness",
          permissionIds: permIds,
          rank: 45,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.role.name).toBe("Poultry Health Specialist");
      expect(createRes.body.role.rank).toBe(45);
      const customRoleId = createRes.body.role.id;

      // Verify custom role shows up in Farm 1 reference roles list
      const refResFarm1 = await request(app)
        .get(`/api/reference/roles?farmId=${farm1Id}`)
        .set("Cookie", companyAdmin.cookie);

      const roleNames = refResFarm1.body.roles.map((r: any) => r.name);
      expect(roleNames).toContain("Poultry Health Specialist");

      // Verify custom role does NOT show up in Farm 2 reference roles list
      const refResFarm2 = await request(app)
        .get(`/api/reference/roles?farmId=${farm2Id}`)
        .set("Cookie", companyAdmin.cookie);

      const roleNames2 = refResFarm2.body.roles.map((r: any) => r.name);
      expect(roleNames2).not.toContain("Poultry Health Specialist");

      // Clean up: delete custom role
      const delRes = await request(app)
        .delete(`/api/farms/${farm1Id}/roles/${customRoleId}`)
        .set("Cookie", companyAdmin.cookie);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });
  });
});
