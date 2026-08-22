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

export { AUTH_COOKIE_NAME };

export { app, prisma };

let counter = 0;

export function uniqueSuffix(): string {
  counter += 1;

  return `${Date.now().toString(36)}-${counter}`;
}

export interface TestActor {
  employeeRowId: string;
  employeeId: string;
  userId: string;
  email: string;
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
  const company = await prisma.company.findFirst({
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

// Creates an employee + login account holding exactly one seeded role, so the
// real role/permission matrix is what the tests exercise.
export async function createActor(roleName: string): Promise<TestActor> {
  const suffix = uniqueSuffix();

  const designationId = await getDesignationId();

  const employee = await prisma.employee.create({
    data: {
      employeeId: `${TEST_PREFIX}${suffix}`,
      name: `Test ${roleName}`,
      desiginationId: designationId,
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
    cookie: await login(email),
  };
}

export async function createTestFarm(
  status: "ACTIVE" | "INACTIVE" = "ACTIVE",
): Promise<{ id: string; code: string }> {
  const companyId = await getSeededCompanyId();

  return prisma.farm.create({
    data: {
      companyId,
      code: `${TEST_PREFIX}${uniqueSuffix()}`,
      name: "Test Farm",
      status,
    },
    select: {
      id: true,
      code: true,
    },
  });
}

export async function createTestEmployeeRecord(): Promise<{ id: string }> {
  const designationId = await getDesignationId();

  return prisma.employee.create({
    data: {
      employeeId: `${TEST_PREFIX}${uniqueSuffix()}`,
      name: "Test Employee",
      desiginationId: designationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });
}

// Deletion order respects the RESTRICT foreign keys: users before employees and
// sheds before farms.
export async function cleanupTestData(): Promise<void> {
  await prisma.user.deleteMany({
    where: {
      email: {
        endsWith: TEST_EMAIL_DOMAIN,
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
}

export function containsSensitiveFields(payload: unknown): boolean {
  return /passwordHash|otpHash|selectionToken/.test(JSON.stringify(payload));
}
