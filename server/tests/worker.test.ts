import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  containsSensitiveFields,
  createActor,
  createTestCompany,
  createTestFarm,
  createTestWorker,
  getDesignationId,
  loginSystemAdmin,
  prisma,
  TEST_EMAIL_DOMAIN,
  TEST_PREFIX,
  uniqueSuffix,
  type TestActor,
} from "./helpers.js";

describe("worker module", () => {
  // Company A owns farms A1 and A2 (cross-farm, same company); company B is a
  // separate company (cross-company). The DGM is FARM-scoped to A1.
  let systemAdminCookie: string;
  let dgm: TestActor;
  let accountant: TestActor;
  let accountsAssistant: TestActor;
  let incharge: TestActor;
  let supervisor: TestActor;
  let farmA1Id: string;
  let farmA2Id: string;
  let companyAdmin: TestActor;
  let workerA2Id: string;
  let workerBId: string;

  beforeAll(async () => {
    await cleanupTestData();

    const companyA = await createTestCompany();
    const companyB = await createTestCompany();
    const farmA1 = await createTestFarm("ACTIVE", companyA.id);
    const farmA2 = await createTestFarm("ACTIVE", companyA.id);
    const farmB1 = await createTestFarm("ACTIVE", companyB.id);

    farmA1Id = farmA1.id;
    farmA2Id = farmA2.id;

    const workerA2 = await createTestWorker(farmA2.id);
    const workerB = await createTestWorker(farmB1.id);

    workerA2Id = workerA2.id;
    workerBId = workerB.id;

    systemAdminCookie = await loginSystemAdmin();
    companyAdmin = await createActor("Company Admin", { farmId: farmA1.id });
    dgm = await createActor("DGM", { farmId: farmA1.id });
    accountant = await createActor("Accountant", { farmId: farmA1.id });
    accountsAssistant = await createActor("Accounts Assistant", { farmId: farmA1.id });
    incharge = await createActor("Incharge", { farmId: farmA1.id });
    supervisor = await createActor("Supervisor", { farmId: farmA1.id });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/workers");

    expect(response.status).toBe(401);
  });

  it("creates a worker in the caller's farm with no login attached", async () => {
    const workerId = `${TEST_PREFIX}${uniqueSuffix()}`;

    const response = await request(app)
      .post("/api/workers")
      .set("Cookie", dgm.cookie)
      .send({ workerId, name: "Field Worker", farmId: farmA1Id });

    expect(response.status).toBe(201);
    expect(response.body.worker.workerId).toBe(workerId);
    expect(response.body.worker.status).toBe("ACTIVE");
    expect(response.body.worker.farm.id).toBe(farmA1Id);
    // A worker is an operational record only: no credential fields, and the safe
    // shape carries no user/login linkage at all.
    expect(Object.keys(response.body.worker).sort()).toEqual([
      "farm",
      "id",
      "name",
      "phone",
      "photoUrl",
      "status",
      "workerId",
    ]);
    expect(containsSensitiveFields(response.body)).toBe(false);
  });

  it("generates the next worker ID from the target farm only", async () => {
    const farmAWorkers = 5;

    for (let index = 0; index < farmAWorkers; index += 1) {
      await createTestWorker(farmA1Id);
    }

    const seededWorkerId = `${TEST_PREFIX}${uniqueSuffix()}-W1`;

    const seeded = await request(app)
      .post("/api/workers")
      .set("Cookie", companyAdmin.cookie)
      .send({
        workerId: seededWorkerId,
        name: "Seeded Farm B Worker",
        farmId: farmA2Id,
      });

    expect(seeded.status).toBe(201);

    const workerCount = await prisma.worker.count({
      where: { farmId: farmA2Id },
    });

    const response = await request(app)
      .post("/api/workers")
      .set("Cookie", companyAdmin.cookie)
      .send({
        name: "Farm B Auto Worker",
        farmId: farmA2Id,
      });

    expect(response.status).toBe(201);
    expect(response.body.worker.workerId).toBe(
      `Test Farm-W${workerCount + 1}`,
    );
  });

  it("rejects a duplicate worker ID", async () => {
    const workerId = `${TEST_PREFIX}${uniqueSuffix()}`;
    const payload = { workerId, name: "Dup", farmId: farmA1Id };

    const first = await request(app)
      .post("/api/workers")
      .set("Cookie", dgm.cookie)
      .send(payload);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/workers")
      .set("Cookie", dgm.cookie)
      .send(payload);

    expect(second.status).toBe(409);
  });

  it("rejects a worker for an unknown farm", async () => {
    const response = await request(app)
      .post("/api/workers")
      .set("Cookie", dgm.cookie)
      .send({
        workerId: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Orphan",
        farmId: "00000000-0000-0000-0000-000000000000",
      });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid farm ID", async () => {
    const response = await request(app)
      .post("/api/workers")
      .set("Cookie", dgm.cookie)
      .send({
        workerId: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Bad farm",
        farmId: "not-a-uuid",
      });

    expect(response.status).toBe(400);
  });

  it("denies creating a worker in another farm of the same company", async () => {
    const response = await request(app)
      .post("/api/workers")
      .set("Cookie", dgm.cookie)
      .send({
        workerId: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Cross-farm",
        farmId: farmA2Id,
      });

    expect(response.status).toBe(403);
  });

  it("denies worker creation to the Supervisor role", async () => {
    const response = await request(app)
      .post("/api/workers")
      .set("Cookie", supervisor.cookie)
      .send({
        workerId: `${TEST_PREFIX}${uniqueSuffix()}`,
        name: "Not allowed",
        farmId: farmA1Id,
      });

    expect(response.status).toBe(403);
  });

  it("updates a worker in the caller's farm", async () => {
    const worker = await createTestWorker(farmA1Id);

    const response = await request(app)
      .patch(`/api/workers/${worker.id}`)
      .set("Cookie", dgm.cookie)
      .send({ name: "Renamed Worker" });

    expect(response.status).toBe(200);
    expect(response.body.worker.name).toBe("Renamed Worker");
  });

  it("allows the Incharge role to update a worker", async () => {
    const worker = await createTestWorker(farmA1Id);

    const response = await request(app)
      .patch(`/api/workers/${worker.id}`)
      .set("Cookie", incharge.cookie)
      .send({ name: "Renamed by Incharge" });

    expect(response.status).toBe(200);
    expect(response.body.worker.name).toBe("Renamed by Incharge");
  });

  it("allows the Accounts Assistant role to update a worker", async () => {
    const worker = await createTestWorker(farmA1Id);

    const response = await request(app)
      .patch(`/api/workers/${worker.id}`)
      .set("Cookie", accountsAssistant.cookie)
      .send({ name: "Renamed by Accounts Assistant" });

    expect(response.status).toBe(200);
    expect(response.body.worker.name).toBe("Renamed by Accounts Assistant");
  });

  it("runs the worker activation lifecycle", async () => {
    const worker = await createTestWorker(farmA1Id);

    const deactivated = await request(app)
      .patch(`/api/workers/${worker.id}/deactivate`)
      .set("Cookie", dgm.cookie);

    expect(deactivated.status).toBe(200);
    expect(deactivated.body.worker.status).toBe("INACTIVE");

    const repeated = await request(app)
      .patch(`/api/workers/${worker.id}/deactivate`)
      .set("Cookie", dgm.cookie);

    expect(repeated.status).toBe(409);

    const reactivated = await request(app)
      .patch(`/api/workers/${worker.id}/reactivate`)
      .set("Cookie", dgm.cookie);

    expect(reactivated.status).toBe(200);
    expect(reactivated.body.worker.status).toBe("ACTIVE");
  });

  it("denies the worker lifecycle to the Supervisor role", async () => {
    const worker = await createTestWorker(farmA1Id);

    const response = await request(app)
      .patch(`/api/workers/${worker.id}/deactivate`)
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(403);
  });

  it("hides a worker in another farm as not found", async () => {
    const response = await request(app)
      .get(`/api/workers/${workerA2Id}`)
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(404);
  });

  it("hides a worker in another company as not found", async () => {
    const response = await request(app)
      .get(`/api/workers/${workerBId}`)
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(404);
  });

  it("denies updating a worker in another company", async () => {
    const response = await request(app)
      .patch(`/api/workers/${workerBId}`)
      .set("Cookie", dgm.cookie)
      .send({ name: "Cross-company rename" });

    expect(response.status).toBe(403);
  });

  it("scopes the worker list to the caller's farm", async () => {
    const response = await request(app)
      .get("/api/workers")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.workers)).toBe(true);
    // A2 and B workers exist but must never appear for a farm-A1 caller.
    for (const worker of response.body.workers) {
      expect(worker.farm.id).toBe(farmA1Id);
    }
  });

  it("paginates the worker list", async () => {
    await createTestWorker(farmA1Id);
    await createTestWorker(farmA1Id);

    const response = await request(app)
      .get("/api/workers")
      .set("Cookie", dgm.cookie)
      .query({ page: 1, limit: 1 });

    expect(response.status).toBe(200);
    expect(response.body.workers).toHaveLength(1);
    expect(response.body.pagination.limit).toBe(1);
    expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it("lets the System Admin read workers across every farm", async () => {
    const response = await request(app)
      .get("/api/workers")
      .set("Cookie", systemAdminCookie);

    expect(response.status).toBe(200);

    const ids = response.body.workers.map((w: { id: string }) => w.id);

    expect(ids).toContain(workerA2Id);
    expect(ids).toContain(workerBId);
  });

  it("allows DGM to delete a worker", async () => {
    const worker = await createTestWorker(farmA1Id);

    const response = await request(app)
      .delete(`/api/workers/${worker.id}`)
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const found = await prisma.worker.findUnique({
      where: { id: worker.id },
    });
    expect(found).toBeNull();
  });

  it("allows Accountant to delete a worker", async () => {
    const worker = await createTestWorker(farmA1Id);

    const response = await request(app)
      .delete(`/api/workers/${worker.id}`)
      .set("Cookie", accountant.cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const found = await prisma.worker.findUnique({
      where: { id: worker.id },
    });
    expect(found).toBeNull();
  });

  it("denies Supervisor from deleting a worker", async () => {
    const worker = await createTestWorker(farmA1Id);

    const response = await request(app)
      .delete(`/api/workers/${worker.id}`)
      .set("Cookie", supervisor.cookie);

    expect(response.status).toBe(403);

    const found = await prisma.worker.findUnique({
      where: { id: worker.id },
    });
    expect(found).not.toBeNull();
  });

  it("returns 404 when deleting a non-existent worker", async () => {
    const response = await request(app)
      .delete("/api/workers/00000000-0000-0000-0000-000000000000")
      .set("Cookie", dgm.cookie);

    expect(response.status).toBe(404);
  });

  describe("promotion to employee", () => {
    it("promotes a worker to a regular employee without directly creating a user login account", async () => {
      const designationId = await getDesignationId();
      const worker = await createTestWorker(farmA1Id);

      const response = await request(app)
        .post(`/api/workers/${worker.id}/promote`)
        .set("Cookie", dgm.cookie)
        .send({
          designationId,
          phone: "+919876543210",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.employee).toBeDefined();
      expect(response.body.employee.status).toBe("ACTIVE");
      expect(response.body.employee.hasUser).toBe(false);
      expect(response.body.employee.promotedFromWorker).toBeDefined();
      expect(response.body.employee.promotedFromWorker.id).toBe(worker.id);

      // Verify the worker in DB is now PROMOTED with link to employee
      const updatedWorker = await prisma.worker.findUnique({
        where: { id: worker.id },
      });
      expect(updatedWorker?.status).toBe("PROMOTED");
      expect(updatedWorker?.promotedToEmployeeId).toBe(response.body.employee.id);

      // Cannot promote again
      const duplicatePromotion = await request(app)
        .post(`/api/workers/${worker.id}/promote`)
        .set("Cookie", dgm.cookie)
        .send({ designationId });

      expect(duplicatePromotion.status).toBe(409);

      // The promoted individual is a standard employee: a login can now be provisioned via the employee user endpoint
      const role = await prisma.role.findFirst({ select: { id: true } });
      const provisionResponse = await request(app)
        .post(`/api/employees/${response.body.employee.id}/user`)
        .set("Cookie", dgm.cookie)
        .send({
          email: `${TEST_PREFIX}${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`,
          roleId: role!.id,
        });

      expect(provisionResponse.status).toBe(201);
      expect(provisionResponse.body.user.employee.id).toBe(response.body.employee.id);
    });
  });
});
