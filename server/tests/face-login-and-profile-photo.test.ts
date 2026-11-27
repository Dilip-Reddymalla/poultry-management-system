import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAnalyzeProfilePhoto, mockUploadImage, mockDeleteImageByUrl } = vi.hoisted(() => ({
  mockAnalyzeProfilePhoto: vi.fn(),
  mockUploadImage: vi.fn(),
  mockDeleteImageByUrl: vi.fn(),
}));

vi.mock("../src/services/face-ai.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/face-ai.service.js")>();
  return {
    ...actual,
    analyzeProfilePhoto: mockAnalyzeProfilePhoto,
  };
});

vi.mock("../src/services/cloudinary.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/cloudinary.service.js")>();
  return {
    ...actual,
    uploadImage: mockUploadImage,
    deleteImageByUrl: mockDeleteImageByUrl,
  };
});

import {
  app,
  cleanupTestData,
  createActor,
  prisma,
  type TestActor,
} from "./helpers.js";
import * as vectorSearch from "../src/services/vector-search.service.js";
import { env } from "../src/config/env.js";

function makeUnitVector(seed: number): number[] {
  const vec = new Array<number>(128).fill(0);
  vec[0] = Math.cos(seed);
  vec[1] = Math.sin(seed);
  return vec;
}

describe("Biometric Face Login & Self-Service Profile Photo", () => {
  let supervisor: TestActor;
  let adminCookie: string;
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  beforeAll(async () => {
    await cleanupTestData();
    supervisor = await createActor("Supervisor");

    // Ensure system admin env is configured for tests and sign in
    env.SYSTEM_ADMIN_EMAIL = env.SYSTEM_ADMIN_EMAIL || "sysadmin-test@poultry.local";
    env.SYSTEM_ADMIN_PASSWORD = env.SYSTEM_ADMIN_PASSWORD || "TestAdminPass123!";

    const adminLogin = await request(app).post("/api/auth/login").send({
      email: env.SYSTEM_ADMIN_EMAIL,
      password: env.SYSTEM_ADMIN_PASSWORD,
    });
    expect(adminLogin.status).toBe(200);
    const setCookies = adminLogin.headers["set-cookie"];
    adminCookie = Array.isArray(setCookies) ? setCookies.join("; ") : String(setCookies ?? "");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM system_admin_profiles WHERE id = 'system-admin'`);
    } catch {
      // ignore if table not created
    }
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("allows general employee to update profile photo, stores embedding, and cleans up old Cloudinary photo", async () => {
    const emb1 = makeUnitVector(0.1);
    mockAnalyzeProfilePhoto.mockResolvedValueOnce({
      selected_face: {
        quality: { usable: true, reasons: [] },
        liveness: { decision: "LIVE" },
        embedding: emb1,
      },
      selection_reason: "centered",
    });
    mockUploadImage.mockResolvedValueOnce({
      url: "https://res.cloudinary.com/demo/image/upload/v1/employees/profiles/first.jpg",
      publicId: "employees/profiles/first",
    });

    const res1 = await request(app)
      .patch("/api/auth/me/photo")
      .set("Cookie", supervisor.cookie)
      .attach("photo", fakeJpeg, "selfie1.jpg");

    expect(res1.status).toBe(200);
    expect(res1.body.user.employee.photoUrl).toBe(
      "https://res.cloudinary.com/demo/image/upload/v1/employees/profiles/first.jpg",
    );
    expect(mockDeleteImageByUrl).not.toHaveBeenCalled();

    // Update again — old Cloudinary URL must be deleted
    mockAnalyzeProfilePhoto.mockResolvedValueOnce({
      selected_face: {
        quality: { usable: true, reasons: [] },
        liveness: { decision: "LIVE" },
        embedding: makeUnitVector(0.11),
      },
      selection_reason: "centered",
    });
    mockUploadImage.mockResolvedValueOnce({
      url: "https://res.cloudinary.com/demo/image/upload/v2/employees/profiles/second.jpg",
      publicId: "employees/profiles/second",
    });

    const res2 = await request(app)
      .patch("/api/auth/me/photo")
      .set("Cookie", supervisor.cookie)
      .attach("photo", fakeJpeg, "selfie2.jpg");

    expect(res2.status).toBe(200);
    expect(res2.body.user.employee.photoUrl).toBe(
      "https://res.cloudinary.com/demo/image/upload/v2/employees/profiles/second.jpg",
    );
    expect(mockDeleteImageByUrl).toHaveBeenCalledWith(
      "https://res.cloudinary.com/demo/image/upload/v1/employees/profiles/first.jpg",
    );
  });

  it("logs in general employee via face unlock when similarity >= 0.62 and liveness is LIVE", async () => {
    mockAnalyzeProfilePhoto.mockResolvedValueOnce({
      selected_face: {
        quality: { usable: true, reasons: [] },
        liveness: { decision: "LIVE" },
        embedding: makeUnitVector(0.1),
      },
      selection_reason: "centered",
    });

    const searchSpy = vi.spyOn(vectorSearch, "searchByEmbedding").mockResolvedValueOnce([
      {
        id: supervisor.employeeRowId,
        personType: "EMPLOYEE",
        personCode: supervisor.employeeId,
        name: "Supervisor",
        photoUrl: null,
        farmId: supervisor.farmId,
        similarity: 0.78,
      },
    ]);

    const res = await request(app)
      .post("/api/auth/face/login")
      .attach("photo", fakeJpeg, "unlock.jpg");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(supervisor.userId);
    expect(res.body.similarity).toBeCloseTo(0.78, 2);
    expect(res.headers["set-cookie"]).toBeDefined();
    searchSpy.mockRestore();
  });

  it("rejects face login when similarity is below 0.62 (even if above attendance 0.40)", async () => {
    mockAnalyzeProfilePhoto.mockResolvedValueOnce({
      selected_face: {
        quality: { usable: true, reasons: [] },
        liveness: { decision: "LIVE" },
        embedding: makeUnitVector(0.5),
      },
      selection_reason: "centered",
    });

    const searchSpy = vi.spyOn(vectorSearch, "searchByEmbedding").mockResolvedValueOnce([
      {
        id: supervisor.employeeRowId,
        personType: "EMPLOYEE",
        personCode: supervisor.employeeId,
        name: "Supervisor",
        photoUrl: null,
        farmId: supervisor.farmId,
        similarity: 0.52,
      },
    ]);

    const res = await request(app)
      .post("/api/auth/face/login")
      .attach("photo", fakeJpeg, "weak.jpg");

    expect(res.status).toBe(401);
    searchSpy.mockRestore();
  });

  it("rejects face login when liveness is SPOOF or match is ambiguous", async () => {
    mockAnalyzeProfilePhoto.mockResolvedValueOnce({
      selected_face: {
        quality: { usable: true, reasons: [] },
        liveness: { decision: "SPOOF" },
        embedding: makeUnitVector(0.1),
      },
      selection_reason: "centered",
    });

    const spoofRes = await request(app)
      .post("/api/auth/face/login")
      .attach("photo", fakeJpeg, "spoof.jpg");
    expect(spoofRes.status).toBe(401);

    // Ambiguous close matches (margin < 0.08)
    mockAnalyzeProfilePhoto.mockResolvedValueOnce({
      selected_face: {
        quality: { usable: true, reasons: [] },
        liveness: { decision: "LIVE" },
        embedding: makeUnitVector(0.1),
      },
      selection_reason: "centered",
    });

    const searchSpy = vi.spyOn(vectorSearch, "searchByEmbedding").mockResolvedValueOnce([
      {
        id: supervisor.employeeRowId,
        personType: "EMPLOYEE",
        personCode: supervisor.employeeId,
        name: "Emp A",
        photoUrl: null,
        farmId: supervisor.farmId,
        similarity: 0.72,
      },
      {
        id: "other-emp-id",
        personType: "EMPLOYEE",
        personCode: "EMP-999",
        name: "Emp B",
        photoUrl: null,
        farmId: supervisor.farmId,
        similarity: 0.69,
      },
    ]);

    const ambigRes = await request(app)
      .post("/api/auth/face/login")
      .attach("photo", fakeJpeg, "ambiguous.jpg");
    expect(ambigRes.status).toBe(401);
    searchSpy.mockRestore();
  });

  it("allows system admin to update profile photo + embedding and log in via face unlock", async () => {
    const adminVec = makeUnitVector(2.2);

    mockAnalyzeProfilePhoto.mockResolvedValueOnce({
      selected_face: {
        quality: { usable: true, reasons: [] },
        liveness: { decision: "LIVE" },
        embedding: adminVec,
      },
      selection_reason: "centered",
    });
    mockUploadImage.mockResolvedValueOnce({
      url: "https://res.cloudinary.com/demo/image/upload/v1/system-admin/profiles/admin1.jpg",
      publicId: "system-admin/profiles/admin1",
    });

    const uploadRes = await request(app)
      .patch("/api/auth/me/photo")
      .set("Cookie", adminCookie)
      .attach("photo", fakeJpeg, "admin.jpg");

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.user.isSystemAdmin).toBe(true);
    expect(uploadRes.body.user.employee.photoUrl).toBe(
      "https://res.cloudinary.com/demo/image/upload/v1/system-admin/profiles/admin1.jpg",
    );

    // Verify /auth/me reflects persisted photoUrl
    const meRes = await request(app).get("/api/auth/me").set("Cookie", adminCookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.employee.photoUrl).toBe(
      "https://res.cloudinary.com/demo/image/upload/v1/system-admin/profiles/admin1.jpg",
    );

    // Face login as system admin
    mockAnalyzeProfilePhoto.mockResolvedValueOnce({
      selected_face: {
        quality: { usable: true, reasons: [] },
        liveness: { decision: "LIVE" },
        embedding: adminVec,
      },
      selection_reason: "centered",
    });
    const searchSpy = vi.spyOn(vectorSearch, "searchByEmbedding").mockResolvedValueOnce([]);

    const loginRes = await request(app)
      .post("/api/auth/face/login")
      .attach("photo", fakeJpeg, "admin-unlock.jpg");

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.isSystemAdmin).toBe(true);
    expect(loginRes.body.similarity).toBeGreaterThanOrEqual(0.99);
    expect(loginRes.headers["set-cookie"]).toBeDefined();
    searchSpy.mockRestore();
  });
});
