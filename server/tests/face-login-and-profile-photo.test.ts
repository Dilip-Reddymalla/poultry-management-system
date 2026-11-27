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
  let secondEmployee: TestActor;
  let adminCookie: string;
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  // Snapshot of the real System Admin profile row (if any) so the tests never
  // destroy a photo/embedding a developer set up in the shared dev DB.
  let existingAdminProfile: { photoUrl: string | null; faceEmbedding: number[] | null } | null = null;

  beforeAll(async () => {
    await cleanupTestData();
    supervisor = await createActor("Supervisor");
    secondEmployee = await createActor("Supervisor");

    // Preserve the real System Admin biometrics before this suite writes to the
    // shared system_admin_profiles row.
    try {
      const rows = await prisma.$queryRawUnsafe<
        Array<{ photo_url: string | null; face_embedding: number[] | null }>
      >(
        `SELECT photo_url, face_embedding FROM system_admin_profiles WHERE id = $1`,
        "system-admin",
      );
      const row = rows[0];
      existingAdminProfile = row
        ? { photoUrl: row.photo_url, faceEmbedding: row.face_embedding }
        : null;
    } catch {
      existingAdminProfile = null;
    }

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
      if (existingAdminProfile) {
        await prisma.$executeRawUnsafe(
          `UPDATE system_admin_profiles
             SET photo_url = $2, face_embedding = $3::float8[], updated_at = NOW()
           WHERE id = $1`,
          "system-admin",
          existingAdminProfile.photoUrl,
          existingAdminProfile.faceEmbedding ?? null,
        );
      } else {
        await prisma.$executeRawUnsafe(`DELETE FROM system_admin_profiles WHERE id = 'system-admin'`);
      }
    } catch {
      // ignore if table not created / restore failure
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

    // --- Scenario 1: two resolvable accounts -> show the account chooser ---
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
        id: secondEmployee.employeeRowId,
        personType: "EMPLOYEE",
        personCode: secondEmployee.employeeId,
        name: "Emp B",
        photoUrl: null,
        farmId: secondEmployee.farmId,
        similarity: 0.69,
      },
    ]);

    const pickerRes = await request(app)
      .post("/api/auth/face/login")
      .attach("photo", fakeJpeg, "ambiguous.jpg");
    // Two strong matches that both resolve to accounts -> ask which one.
    expect(pickerRes.status).toBe(200);
    expect(pickerRes.body.requiresUserSelection).toBe(true);
    expect(pickerRes.body.selectionToken).toBeDefined();
    expect(pickerRes.body.users).toHaveLength(2);

    const selectRes = await request(app)
      .post("/api/auth/face/select-user")
      .send({ selectionToken: pickerRes.body.selectionToken, accountId: supervisor.userId });
    expect(selectRes.status).toBe(200);
    expect(selectRes.body.user.id).toBe(supervisor.userId);
    expect(selectRes.headers["set-cookie"]).toBeDefined();
    searchSpy.mockRestore();

    // --- Scenario 2: second strong match is NOT a resolvable account, so only
    // one account is actionable -> auto-login, no misleading single-option
    // picker. ---
    mockAnalyzeProfilePhoto.mockResolvedValueOnce({
      selected_face: {
        quality: { usable: true, reasons: [] },
        liveness: { decision: "LIVE" },
        embedding: makeUnitVector(0.1),
      },
      selection_reason: "centered",
    });

    const searchSpy2 = vi.spyOn(vectorSearch, "searchByEmbedding").mockResolvedValueOnce([
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

    const autoRes = await request(app)
      .post("/api/auth/face/login")
      .attach("photo", fakeJpeg, "auto.jpg");
    expect(autoRes.status).toBe(200);
    expect(autoRes.body.requiresUserSelection).toBe(false);
    expect(autoRes.body.user.id).toBe(supervisor.userId);
    expect(autoRes.headers["set-cookie"]).toBeDefined();
    searchSpy2.mockRestore();
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
