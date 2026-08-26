import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  containsSensitiveFields,
  createActor,
  createTestCompany,
  createTestEmployeeRecord,
  createTestFarm,
  extractAuthCookie,
  prisma,
  TEST_EMAIL_DOMAIN,
  uniqueSuffix,
  type TestActor,
} from "./helpers.js";
import { hashOtp, OTP_EXPIRY_MS } from "../src/utils/otp.js";
import { normalizePhone } from "../src/utils/phone.js";

// First-login OTP: no real SMS is sent. The test seeds the challenge row that
// the HTTPSMS provider would otherwise create, then drives the real verify-otp
// endpoint. A fixed code keeps the hash deterministic.
const FIRST_LOGIN_OTP = "123456";
const NEW_PASSWORD = "SetPass@12345";

describe("first-login provisioning flow", () => {
  // A DGM holds user:create and is FARM-scoped to the provisioning farm, so it is
  // authorized to provision accounts for employees in that farm.
  let dgm: TestActor;
  let farmId: string;
  let supervisorRoleId: string;
  const seededPhones: string[] = [];

  // Provisions a fresh passwordless Supervisor account through the real API and
  // returns the credentials the first-login flow needs.
  async function provisionAccount(): Promise<{ email: string; phone: string }> {
    const employee = await createTestEmployeeRecord(farmId);
    const email = `tmp-test-${uniqueSuffix()}${TEST_EMAIL_DOMAIN}`;

    const response = await request(app)
      .post(`/api/employees/${employee.id}/user`)
      .set("Cookie", dgm.cookie)
      .send({ email, roleId: supervisorRoleId });

    expect(response.status).toBe(201);
    expect(response.body.user.mustSetPassword).toBe(true);
    expect(response.body.user.roles).toContain("Supervisor");
    expect(containsSensitiveFields(response.body)).toBe(false);

    return { email, phone: employee.phone };
  }

  // Seeds the OTP challenge the SMS provider would have created, then verifies it
  // through the real endpoint. Returns the login response (cookie set on 200).
  async function verifyFirstLoginOtp(phone: string): Promise<request.Response> {
    const normalized = normalizePhone(phone);
    seededPhones.push(normalized);

    await prisma.otpChallenge.create({
      data: {
        phone: normalized,
        otpHash: await hashOtp(FIRST_LOGIN_OTP),
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });

    return request(app)
      .post("/api/auth/phone/verify-otp")
      .send({ phone: normalized, otp: FIRST_LOGIN_OTP });
  }

  beforeAll(async () => {
    await cleanupTestData();

    const company = await createTestCompany();
    const farm = await createTestFarm("ACTIVE", company.id);

    farmId = farm.id;

    const supervisorRole = await prisma.role.findUniqueOrThrow({
      where: { name: "Supervisor" },
      select: { id: true },
    });

    supervisorRoleId = supervisorRole.id;
    dgm = await createActor("DGM", { farmId });
  });

  afterAll(async () => {
    // cleanupTestData does not touch otp_challenges; remove the seeded rows here.
    if (seededPhones.length > 0) {
      await prisma.otpChallenge.deleteMany({
        where: { phone: { in: seededPhones } },
      });
    }

    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("rejects normal password login before a password is set", async () => {
    const { email } = await provisionAccount();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password: NEW_PASSWORD });

    // The account has no password hash yet, so it cannot be signed in with the
    // normal endpoint — this is what stops a provisioned account from bypassing
    // the mandatory setup step.
    expect(response.status).toBe(401);
  });

  it("blocks business routes until the password is set", async () => {
    const { phone } = await provisionAccount();

    const verified = await verifyFirstLoginOtp(phone);

    expect(verified.status).toBe(200);
    expect(verified.body.requiresUserSelection).toBe(false);
    expect(verified.body.user.mustSetPassword).toBe(true);

    const cookie = extractAuthCookie(verified.headers["set-cookie"]);

    const blocked = await request(app)
      .get("/api/employees")
      .set("Cookie", cookie);

    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PASSWORD_SETUP_REQUIRED");
  });

  it("completes provision → OTP → set password → normal login", async () => {
    const { email, phone } = await provisionAccount();

    // 1. First login by OTP (no password exists yet).
    const verified = await verifyFirstLoginOtp(phone);

    expect(verified.status).toBe(200);

    const firstLoginCookie = extractAuthCookie(verified.headers["set-cookie"]);

    // 2. Mandatory password setup, gated to the authenticated first-login session.
    const setPassword = await request(app)
      .post("/api/auth/set-password")
      .set("Cookie", firstLoginCookie)
      .send({ password: NEW_PASSWORD });

    expect(setPassword.status).toBe(200);
    expect(setPassword.body.message).toBe("Password set successfully");
    expect(setPassword.body.user.mustSetPassword).toBe(false);
    expect(containsSensitiveFields(setPassword.body)).toBe(false);

    // 3. The rotated session now clears the restricted state on business routes.
    const rotatedCookie = extractAuthCookie(setPassword.headers["set-cookie"]);

    const afterSetup = await request(app)
      .get("/api/employees")
      .set("Cookie", rotatedCookie);

    expect(afterSetup.status).toBe(200);

    // 4. Setting the password twice is refused.
    const repeated = await request(app)
      .post("/api/auth/set-password")
      .set("Cookie", rotatedCookie)
      .send({ password: NEW_PASSWORD });

    expect(repeated.status).toBe(409);

    // 5. Normal password + email login now works.
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: NEW_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.user.mustSetPassword).toBe(false);
  });
});
