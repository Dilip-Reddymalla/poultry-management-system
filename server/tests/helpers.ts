import request from "supertest";

import app from "../src/app.js";
import { prisma } from "../src/config/database.js";
import { AUTH_COOKIE_NAME } from "../src/utils/auth-cookie.js";
import { hashPassword } from "../src/utils/password.js";

// Every fixture this suite creates is prefixed/suffixed so cleanup can delete
// exactly the test rows and never touch seeded data.
export const TEST_PREFIX = "TMP-TEST-";
export const TEST_EMAIL_DOMAIN = "@example.test";
export const TEST_PASSWORD = "test-password-123";

// The single global System Admin authenticates against these env values (the
// same ones the running server validated at boot), never a database row.
export const SYSTEM_ADMIN_EMAIL = process.env.SYSTEM_ADMIN_EMAIL;
export const SYSTEM_ADMIN_PASSWORD = process.env.SYSTEM_ADMIN_PASSWORD;

export { AUTH_COOKIE_NAME };

export { app, prisma };

let counter = 0;

export function uniqueSuffix(): string {
  counter += 1;

  return `${Date.now().toString(36)}-${counter}`;
}

let phoneCounter = 0;

// A digits-only phone (survives normalizePhone unchanged) that is unique per
// call, so a provisioned employee resolves to exactly one account at phone
// login. Provisioning requires the employee to have a phone at all.
export function uniquePhone(): string {
  phoneCounter += 1;

  return `9198${Date.now().toString().slice(-7)}${phoneCounter}`;
}

export interface TestActor {
  employeeRowId: string;
  employeeId: string;
  userId: string;
  email: string;
  farmId: string;
  companyId: string;
  cookie: string;
}

async function getWorkerDesignationId(): Promise<string> {
  const designation = await prisma.designation.findFirst({
    where: {
      name: "Worker",
    },
    select: {
      id: true,
    },
  });

  if (!designation) {
    throw new Error("Seed data missing: run `npm run seed` before the tests");
  }

  return designation.id;
}

export async function getSeededCompanyId(): Promise<string> {
  // Must resolve to a real seeded company, never a test fixture. Otherwise a
  // farm created without an explicit company (e.g. a FARM-scoped actor's farm)
  // could attach to a test company and skew that company's farmCount.
  const company = await prisma.company.findFirst({
    where: {
      code: {
        not: {
          startsWith: TEST_PREFIX,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!company) {
    throw new Error("Seed data missing: run `npm run seed` before the tests");
  }

  return company.id;
}

export async function getDesignationId(): Promise<string> {
  return getWorkerDesignationId();
}

export function extractAuthCookie(setCookie: unknown): string {
  const cookies = Array.isArray(setCookie) ? (setCookie as string[]) : [];

  const authCookie = cookies.find((cookie) =>
    cookie.startsWith(`${AUTH_COOKIE_NAME}=`),
  );

  if (!authCookie) {
    throw new Error("Login response did not set an authentication cookie");
  }

  return authCookie.split(";")[0] as string;
}

export async function login(email: string): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password: TEST_PASSWORD,
  });

  if (response.status !== 200) {
    throw new Error(
      `Login failed for ${email} with status ${String(response.status)}`,
    );
  }

  return extractAuthCookie(response.headers["set-cookie"]);
}

// Signs in the env-based System Admin. Tests that need global access call this;
// they must run with SYSTEM_ADMIN_* configured (they are in the dev/test .env).
export async function loginSystemAdmin(): Promise<string> {
  if (!SYSTEM_ADMIN_EMAIL || !SYSTEM_ADMIN_PASSWORD) {
    throw new Error(
      "SYSTEM_ADMIN_EMAIL/SYSTEM_ADMIN_PASSWORD must be set to test System Admin access",
    );
  }

  const response = await request(app).post("/api/auth/login").send({
    email: SYSTEM_ADMIN_EMAIL,
    password: SYSTEM_ADMIN_PASSWORD,
  });

  if (response.status !== 200) {
    throw new Error(
      `System Admin login failed with status ${String(response.status)}`,
    );
  }

  return extractAuthCookie(response.headers["set-cookie"]);
}

export async function createTestCompany(): Promise<{ id: string; code: string }> {
  return prisma.company.create({
    data: {
      code: `${TEST_PREFIX}${uniqueSuffix()}`,
      name: "Test Company",
    },
    select: {
      id: true,
      code: true,
    },
  });
}

export async function createTestFarm(
  status: "ACTIVE" | "INACTIVE" = "ACTIVE",
  companyId?: string,
): Promise<{ id: string; code: string; companyId: string }> {
  const resolvedCompanyId = companyId ?? (await getSeededCompanyId());

  return prisma.farm.create({
    data: {
      companyId: resolvedCompanyId,
      code: `${TEST_PREFIX}${uniqueSuffix()}`,
      name: "Test Farm",
      status,
    },
    select: {
      id: true,
      code: true,
      companyId: true,
    },
  });
}

// Creates an employee + login account holding exactly one seeded role, so the
// real role/permission matrix is what the tests exercise. The employee is placed
// in `opts.farmId` (or a fresh test farm), which fixes the caller's scope: a
// FARM-scoped role only reaches that farm, a COMPANY-scoped role its company.
export async function createActor(
  roleName: string,
  opts: { farmId?: string } = {},
): Promise<TestActor> {
  const suffix = uniqueSuffix();

  const designationId = await getDesignationId();

  const farm =
    opts.farmId !== undefined
      ? await prisma.farm.findUniqueOrThrow({
          where: { id: opts.farmId },
          select: { id: true, companyId: true },
        })
      : await createTestFarm();

  const employee = await prisma.employee.create({
    data: {
      employeeId: `${TEST_PREFIX}${suffix}`,
      name: `Test ${roleName}`,
      desiginationId: designationId,
      farmId: farm.id,
      status: "ACTIVE",
    },
    select: {
      id: true,
      employeeId: true,
    },
  });

  const role = await prisma.role.findUnique({
    where: {
      name: roleName,
    },
    select: {
      id: true,
    },
  });

  if (!role) {
    throw new Error(`Seeded role not found: ${roleName}`);
  }

  const email = `tmp-test-${suffix}${TEST_EMAIL_DOMAIN}`;

  const user = await prisma.user.create({
    data: {
      employeeId: employee.id,
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
    select: {
      id: true,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
    },
  });

  return {
    employeeRowId: employee.id,
    employeeId: employee.employeeId,
    userId: user.id,
    email,
    farmId: farm.id,
    companyId: farm.companyId,
    cookie: await login(email),
  };
}

export async function createTestEmployeeRecord(
  farmId: string,
  opts: { phone?: string } = {},
): Promise<{ id: string; phone: string }> {
  const designationId = await getDesignationId();

  const phone = opts.phone ?? uniquePhone();

  const employee = await prisma.employee.create({
    data: {
      employeeId: `${TEST_PREFIX}${uniqueSuffix()}`,
      name: "Test Employee",
      desiginationId: designationId,
      farmId,
      phone,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  return { id: employee.id, phone };
}

export async function createTestWorker(
  farmId: string,
  status: "ACTIVE" | "INACTIVE" = "ACTIVE",
): Promise<{ id: string; workerId: string }> {
  return prisma.worker.create({
    data: {
      workerId: `${TEST_PREFIX}${uniqueSuffix()}`,
      name: "Test Worker",
      farmId,
      status,
    },
    select: {
      id: true,
      workerId: true,
    },
  });
}

// Deletion respects the RESTRICT foreign keys: attendance references farms,
// employees, workers and users, so it goes first; then users (→ employees),
// workers and employees (→ farms), sheds (→ farms), farms (→ companies), and
// finally the test companies themselves.
export async function cleanupTestData(): Promise<void> {
  await prisma.attendance.deleteMany({
    where: {
      OR: [
        { farm: { code: { startsWith: TEST_PREFIX } } },
        { employee: { employeeId: { startsWith: TEST_PREFIX } } },
        { worker: { workerId: { startsWith: TEST_PREFIX } } },
        { recordedBy: { email: { endsWith: TEST_EMAIL_DOMAIN } } },
        { approvedBy: { email: { endsWith: TEST_EMAIL_DOMAIN } } },
      ],
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: {
        endsWith: TEST_EMAIL_DOMAIN,
      },
    },
  });

  await prisma.worker.deleteMany({
    where: {
      workerId: {
        startsWith: TEST_PREFIX,
      },
    },
  });

  await prisma.employee.deleteMany({
    where: {
      employeeId: {
        startsWith: TEST_PREFIX,
      },
    },
  });

  await prisma.shed.deleteMany({
    where: {
      OR: [
        {
          number: {
            startsWith: TEST_PREFIX,
          },
        },
        {
          farm: {
            code: {
              startsWith: TEST_PREFIX,
            },
          },
        },
      ],
    },
  });

  await prisma.farm.deleteMany({
    where: {
      code: {
        startsWith: TEST_PREFIX,
      },
    },
  });

  await prisma.company.deleteMany({
    where: {
      code: {
        startsWith: TEST_PREFIX,
      },
    },
  });
}

export function containsSensitiveFields(payload: unknown): boolean {
  return /passwordHash|otpHash|selectionToken/.test(JSON.stringify(payload));
}
