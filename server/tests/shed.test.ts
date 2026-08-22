import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  createActor,
  createTestFarm,
  prisma,
  TEST_PREFIX,
  uniqueSuffix,
  type TestActor,
} from "./helpers.js";

describe("shed write operations", () => {
  let assistantManager: TestActor;
  let incharge: TestActor;
  let supervisor: TestActor;
  let farmId: string;

  beforeAll(async () => {
    await cleanupTestData();

    assistantManager = await createActor("Assistant Manager");
    incharge = await createActor("Incharge");
    supervisor = await createActor("Supervisor");

    const farm = await createTestFarm();

    farmId = farm.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function createShed(): Promise<{ id: string; number: string }> {
    const number = `${TEST_PREFIX}${uniqueSuffix()}`;

    const response = await request(app)
      .post("/api/sheds")
      .set("Cookie", assistantManager.cookie)
      .send({ farmId, number, capacity: 5000 });

    if (response.status !== 201) {
      throw new Error(`Shed fixture failed with status ${String(response.status)}`);
    }

    return { id: response.body.shed.id as string, number };
  }

  it("creates a shed under an active farm", async () => {
    const number = `${TEST_PREFIX}${uniqueSuffix()}`;

    const response = await request(app)
      .post("/api/sheds")
      .set("Cookie", assistantManager.cookie)
      .send({ farmId, number, capacity: 4200 });

    expect(response.status).toBe(201);
    expect(response.body.shed.number).toBe(number);
    expect(response.body.shed.capacity).toBe(4200);
    expect(response.body.shed.status).toBe("AVAILABLE");
    expect(response.body.shed.farm.id).toBe(farmId);
  });

  it("denies shed creation to the Supervisor role", async () => {
    const response = await request(app)
      .post("/api/sheds")
      .set("Cookie", supervisor.cookie)
      .send({
        farmId,
        number: `${TEST_PREFIX}${uniqueSuffix()}`,
        capacity: 1000,
      });

    expect(response.status).toBe(403);
  });

  it("rejects a shed for an unknown farm", async () => {
    const response = await request(app)
      .post("/api/sheds")
      .set("Cookie", assistantManager.cookie)
      .send({
        farmId: "00000000-0000-0000-0000-000000000000",
        number: `${TEST_PREFIX}${uniqueSuffix()}`,
        capacity: 1000,
      });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid farm ID", async () => {
    const response = await request(app)
      .post("/api/sheds")
      .set("Cookie", assistantManager.cookie)
      .send({
        farmId: "not-a-uuid",
        number: `${TEST_PREFIX}${uniqueSuffix()}`,
        capacity: 1000,
      });

    expect(response.status).toBe(400);
  });

  it("rejects a shed under an inactive farm", async () => {
    const inactiveFarm = await createTestFarm("INACTIVE");

    const response = await request(app)
      .post("/api/sheds")
      .set("Cookie", assistantManager.cookie)
      .send({
        farmId: inactiveFarm.id,
        number: `${TEST_PREFIX}${uniqueSuffix()}`,
        capacity: 1000,
      });

    expect(response.status).toBe(409);
  });

  it("rejects a negative capacity", async () => {
    const response = await request(app)
      .post("/api/sheds")
      .set("Cookie", assistantManager.cookie)
      .send({
        farmId,
        number: `${TEST_PREFIX}${uniqueSuffix()}`,
        capacity: -1,
      });

    expect(response.status).toBe(400);
  });

  it("rejects a duplicate shed number within the same farm", async () => {
    const shed = await createShed();

    const response = await request(app)
      .post("/api/sheds")
      .set("Cookie", assistantManager.cookie)
      .send({ farmId, number: shed.number, capacity: 1000 });

    expect(response.status).toBe(409);
  });

  it("updates a shed", async () => {
    const shed = await createShed();

    const response = await request(app)
      .patch(`/api/sheds/${shed.id}`)
      .set("Cookie", assistantManager.cookie)
      .send({ capacity: 7500 });

    expect(response.status).toBe(200);
    expect(response.body.shed.capacity).toBe(7500);
  });

  it("never moves a shed to another farm through the update endpoint", async () => {
    const shed = await createShed();
    const otherFarm = await createTestFarm();

    const response = await request(app)
      .patch(`/api/sheds/${shed.id}`)
      .set("Cookie", assistantManager.cookie)
      .send({ farmId: otherFarm.id, status: "INACTIVE", capacity: 6000 });

    expect(response.status).toBe(200);
    expect(response.body.shed.farm.id).toBe(farmId);
    expect(response.body.shed.status).toBe("AVAILABLE");
  });

  it("returns 404 when updating an unknown shed", async () => {
    const response = await request(app)
      .patch("/api/sheds/00000000-0000-0000-0000-000000000000")
      .set("Cookie", assistantManager.cookie)
      .send({ capacity: 100 });

    expect(response.status).toBe(404);
  });

  it("changes shed status and rejects the same status twice", async () => {
    const shed = await createShed();

    const response = await request(app)
      .patch(`/api/sheds/${shed.id}/status`)
      .set("Cookie", incharge.cookie)
      .send({ status: "MAINTENANCE" });

    expect(response.status).toBe(200);
    expect(response.body.shed.status).toBe("MAINTENANCE");

    const repeated = await request(app)
      .patch(`/api/sheds/${shed.id}/status`)
      .set("Cookie", incharge.cookie)
      .send({ status: "MAINTENANCE" });

    expect(repeated.status).toBe(409);
  });

  it("rejects an occupied shed status change", async () => {
    const shed = await createShed();

    await prisma.shed.update({
      where: { id: shed.id },
      data: { status: "OCCUPIED" },
    });

    const response = await request(app)
      .patch(`/api/sheds/${shed.id}/status`)
      .set("Cookie", incharge.cookie)
      .send({ status: "AVAILABLE" });

    expect(response.status).toBe(409);
  });

  it("rejects OCCUPIED as a manually assignable status", async () => {
    const shed = await createShed();

    const response = await request(app)
      .patch(`/api/sheds/${shed.id}/status`)
      .set("Cookie", incharge.cookie)
      .send({ status: "OCCUPIED" });

    expect(response.status).toBe(400);
  });

  it("denies shed status changes to the Supervisor role", async () => {
    const shed = await createShed();

    const response = await request(app)
      .patch(`/api/sheds/${shed.id}/status`)
      .set("Cookie", supervisor.cookie)
      .send({ status: "MAINTENANCE" });

    expect(response.status).toBe(403);
  });

  it("allows the Supervisor role to read sheds", async () => {
    const response = await request(app)
      .get("/api/sheds")
      .set("Cookie", supervisor.cookie)
      .query({ farmId });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.sheds)).toBe(true);
  });
});
