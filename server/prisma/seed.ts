import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { AttendanceStatus, ScopeLevel } from "@prisma/client";
import argon2 from "argon2";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Starting database seed...");

  // DESIGNATIONS ------------------------------------------------------------

  const designations = [
    "Company Admin",
    "DGM",
    "Assistant Manager",
    "Super Incharge",
    "Incharge",
    "Supervisor",
    "Worker",
    "Accountant",
  ];

  for (const name of designations) {
    await prisma.designation.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(`✅ Created/verified ${designations.length} designations`);

  const designationByName = new Map(
    (await prisma.designation.findMany()).map((d) => [d.name, d.id]),
  );

  // ROLES -------------------------------------------------------------------
  //
  // scopeLevel is WHERE the role's permissions apply, relative to the user's own
  // company/farm. Company Admin is COMPANY-wide; every operational role is
  // FARM-scoped. The System Admin is env-based and global, so no role is GLOBAL.

  const roles: { name: string; description: string; scopeLevel: ScopeLevel }[] =
    [
      {
        name: "Company Admin",
        description: "Manages their company and all of its farms",
        scopeLevel: "COMPANY",
      },
      {
        name: "DGM",
        description: "Full authority within their own farm",
        scopeLevel: "FARM",
      },
      {
        name: "Assistant Manager",
        description: "Broad operational management within their farm",
        scopeLevel: "FARM",
      },
      {
        name: "Super Incharge",
        description: "Broad farm operational access",
        scopeLevel: "FARM",
      },
      {
        name: "Incharge",
        description: "Operational supervision access",
        scopeLevel: "FARM",
      },
      {
        name: "Supervisor",
        description: "Assigned shed and operational access",
        scopeLevel: "FARM",
      },
      {
        name: "Accountant",
        description: "Administrative and accounting access",
        scopeLevel: "FARM",
      },
    ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        scopeLevel: role.scopeLevel,
      },
      create: role,
    });
  }

  console.log(`✅ Created/verified ${roles.length} roles`);

  // PERMISSIONS -------------------------------------------------------------

  const permissions = [
    { name: "company:view", description: "View companies" },
    { name: "company:create", description: "Create companies" },
    { name: "company:update", description: "Update company details" },

    { name: "farm:view", description: "View farms" },
    { name: "farm:create", description: "Create farms" },
    { name: "farm:update", description: "Update farm details" },
    { name: "farm:deactivate", description: "Deactivate farms" },
    { name: "farm:reactivate", description: "Reactivate farms" },

    { name: "shed:view", description: "View sheds" },
    { name: "shed:create", description: "Create sheds" },
    { name: "shed:update", description: "Update shed details" },
    { name: "shed:update-status", description: "Change shed operational status" },

    { name: "employee:view", description: "View employee information" },
    { name: "employee:create", description: "Create employees" },
    { name: "employee:update", description: "Update employee information" },
    { name: "employee:deactivate", description: "Deactivate employees" },
    { name: "employee:reactivate", description: "Reactivate employees" },

    { name: "worker:view", description: "View workers" },
    { name: "worker:create", description: "Create workers" },
    { name: "worker:update", description: "Update workers" },

    { name: "attendance:view", description: "View attendance" },
    { name: "attendance:create", description: "Record attendance" },
    { name: "attendance:update", description: "Correct attendance records" },
    { name: "attendance:approve", description: "Approve/finalize attendance" },

    { name: "user:create", description: "Provision login accounts for employees" },

    { name: "report:view", description: "View reports" },
    { name: "report:export", description: "Export reports" },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        description: permission.description,
      },
      create: permission,
    });
  }

  console.log(`✅ Created/verified ${permissions.length} permissions`);

  const permissionByName = new Map(
    (await prisma.permission.findMany()).map((p) => [p.name, p.id]),
  );

  async function assignPermissions(
    roleName: string,
    permissionNames: string[],
  ): Promise<void> {
    const role = await prisma.role.findUnique({ where: { name: roleName } });

    if (!role) {
      throw new Error(`${roleName} role not found`);
    }

    for (const name of permissionNames) {
      const permissionId = permissionByName.get(name);

      if (!permissionId) {
        throw new Error(`${name} permission not found`);
      }

      // Additive only: never deletes an existing role permission.
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  // ROLE → PERMISSION MATRIX ------------------------------------------------
  //
  // Company Admin manages its whole company; the DGM is full authority inside a
  // single farm (everything except company management). Company creation is never
  // granted to any seeded role — it is a global action reserved for the env-based
  // System Admin.

  const companyAdminPermissions = [
    "company:view",
    "company:update",
    "farm:view",
    "farm:create",
    "farm:update",
    "farm:deactivate",
    "farm:reactivate",
    "shed:view",
    "shed:create",
    "shed:update",
    "shed:update-status",
    "employee:view",
    "employee:create",
    "employee:update",
    "employee:deactivate",
    "employee:reactivate",
    "worker:view",
    "worker:create",
    "worker:update",
    "user:create",
    "attendance:view",
    "attendance:create",
    "attendance:update",
    "attendance:approve",
    "report:view",
    "report:export",
  ];

  await assignPermissions("Company Admin", companyAdminPermissions);

  // DGM is farm-scoped full authority: every permission except company management.
  const dgmPermissions = permissions
    .map((permission) => permission.name)
    .filter((name) => !name.startsWith("company:"));

  await assignPermissions("DGM", dgmPermissions);

  const rolePermissionMatrix: { role: string; permissions: string[] }[] = [
    {
      role: "Assistant Manager",
      permissions: [
        "farm:view",
        "shed:view",
        "shed:create",
        "shed:update",
        "shed:update-status",
        "employee:view",
        "employee:create",
        "employee:update",
        "employee:deactivate",
        "employee:reactivate",
        "worker:view",
        "worker:create",
        "worker:update",
        "user:create",
        "attendance:view",
        "attendance:create",
        "attendance:update",
        "attendance:approve",
        "report:view",
        "report:export",
      ],
    },
    {
      role: "Super Incharge",
      permissions: [
        "farm:view",
        "shed:view",
        "shed:update-status",
        "employee:view",
        "worker:view",
        "worker:create",
        "worker:update",
        "attendance:view",
        "attendance:create",
        "attendance:update",
        "report:view",
      ],
    },
    {
      role: "Incharge",
      permissions: [
        "farm:view",
        "shed:view",
        "shed:update-status",
        "employee:view",
        "worker:view",
        "worker:create",
        "worker:update",
        "attendance:view",
        "attendance:create",
        "attendance:update",
        "report:view",
      ],
    },
    {
      role: "Supervisor",
      permissions: [
        "farm:view",
        "shed:view",
        "employee:view",
        "worker:view",
        "attendance:view",
        "attendance:create",
        "report:view",
      ],
    },
    {
      role: "Accountant",
      permissions: [
        "farm:view",
        "shed:view",
        "employee:view",
        "employee:update",
        "employee:deactivate",
        "employee:reactivate",
        "worker:view",
        "worker:create",
        "worker:update",
        "attendance:view",
        "attendance:update",
        "report:view",
        "report:export",
      ],
    },
  ];

  for (const entry of rolePermissionMatrix) {
    await assignPermissions(entry.role, entry.permissions);
    console.log(
      `✅ Assigned ${entry.permissions.length} permissions to ${entry.role}`,
    );
  }

  console.log(
    `✅ Assigned ${companyAdminPermissions.length} permissions to Company Admin, ${dgmPermissions.length} to DGM`,
  );

  /*
  // DEMO ORGANIZATION -------------------------------------------------------
  //
  // The System Admin is intentionally NOT seeded here — it comes only from the
  // SYSTEM_ADMIN_* environment variables. Every seeded login below shares the
  // SEED_DGM_PASSWORD so the demo hierarchy can be exercised end to end.

  const seedDgmEmail = process.env.SEED_DGM_EMAIL;
  const seedDgmPassword = process.env.SEED_DGM_PASSWORD;
  const seedDgmPhone = process.env.SEED_DGM_PHONE;

  if (!seedDgmEmail || !seedDgmPassword || !seedDgmPhone) {
    throw new Error(
      "SEED_DGM_EMAIL, SEED_DGM_PASSWORD and SEED_DGM_PHONE are required for seeding.",
    );
  }

  const demoDomain = seedDgmEmail.includes("@")
    ? seedDgmEmail.slice(seedDgmEmail.indexOf("@") + 1)
    : "demo.local";
  const demoEmail = (local: string): string => `${local}@${demoDomain}`;

  // One hash reused for every seeded login (same password); the OTP second factor
  // still applies at real login time.
  const demoPasswordHash = await argon2.hash(seedDgmPassword);

  async function upsertCompany(code: string, name: string): Promise<string> {
    const company = await prisma.company.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
    return company.id;
  }

  async function upsertFarm(
    companyId: string,
    code: string,
    name: string,
  ): Promise<string> {
    const farm = await prisma.farm.upsert({
      where: { companyId_code: { companyId, code } },
      update: { name },
      create: { companyId, code, name },
    });
    return farm.id;
  }

  async function upsertSheds(farmId: string, count: number): Promise<void> {
    for (let index = 1; index <= count; index += 1) {
      const number = `Shed-${index}`;
      await prisma.shed.upsert({
        where: { farmId_number: { farmId, number } },
        update: {},
        create: { farmId, number, capacity: 5000 },
      });
    }
  }

  async function upsertEmployee(input: {
    employeeId: string;
    name: string;
    phone: string;
    designation: string;
    farmId: string;
  }): Promise<string> {
    const desiginationId = designationByName.get(input.designation);
    if (!desiginationId) {
      throw new Error(`${input.designation} designation not found`);
    }

    const employee = await prisma.employee.upsert({
      where: { employeeId: input.employeeId },
      update: {
        name: input.name,
        phone: input.phone,
        desiginationId,
        farmId: input.farmId,
        status: "ACTIVE",
      },
      create: {
        employeeId: input.employeeId,
        name: input.name,
        phone: input.phone,
        desiginationId,
        farmId: input.farmId,
        status: "ACTIVE",
      },
    });
    return employee.id;
  }

  async function provisionUser(input: {
    employeeId: string;
    email: string;
    role: string;
  }): Promise<string> {
    const role = await prisma.role.findUnique({ where: { name: input.role } });
    if (!role) {
      throw new Error(`${input.role} role not found`);
    }

    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: {
        employeeId: input.employeeId,
        passwordHash: demoPasswordHash,
        mustSetPassword: false,
        isActive: true,
      },
      create: {
        employeeId: input.employeeId,
        email: input.email,
        passwordHash: demoPasswordHash,
        mustSetPassword: false,
        isActive: true,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    return user.id;
  }

  async function upsertWorker(input: {
    workerId: string;
    name: string;
    phone: string;
    farmId: string;
  }): Promise<string> {
    const worker = await prisma.worker.upsert({
      where: { workerId: input.workerId },
      update: {
        name: input.name,
        phone: input.phone,
        farmId: input.farmId,
        status: "ACTIVE",
      },
      create: {
        workerId: input.workerId,
        name: input.name,
        phone: input.phone,
        farmId: input.farmId,
        status: "ACTIVE",
      },
    });
    return worker.id;
  }

  async function upsertEmployeeAttendance(input: {
    date: Date;
    employeeId: string;
    farmId: string;
    status: AttendanceStatus;
    shift: Shift;
    latitude: number;
    longitude: number;
    recordedById: string;
    approvedById?: string;
  }) {
    await prisma.attendance.upsert({
      where: {
        date_shift_employeeId: {
          date: input.date,
          shift: input.shift,
          employeeId: input.employeeId,
        },
      },
      update: {},
      create: {
        ...input,
        approvedAt: input.approvedById ? new Date() : null,
      },
    });
  }

  async function upsertWorkerAttendance(input: {
    date: Date;
    workerId: string;
    farmId: string;
    status: AttendanceStatus;
    shift: Shift;
    latitude: number;
    longitude: number;
    recordedById: string;
    approvedById?: string;
  }) {
    await prisma.attendance.upsert({
      where: {
        date_shift_workerId: {
          date: input.date,
          shift: input.shift,
          workerId: input.workerId,
        },
      },
      update: {},
      create: {
        ...input,
        approvedAt: input.approvedById ? new Date() : null,
      },
    });
  }

  // Fixed calendar days keep attendance upserts idempotent across reseeds.
  const day1 = new Date("2026-08-24T00:00:00.000Z");
  const day2 = new Date("2026-08-25T00:00:00.000Z");

  // --- Company PMS (existing) — preserved: code PMS, farm SR-1, EMP001 DGM -----

  const pmsId = await upsertCompany("PMS", "Poultry Management Company");

  const pmsAdminEmpId = await upsertEmployee({
    employeeId: "PMS-ADMIN",
    name: "PMS Company Admin",
    phone: "919000000001",
    designation: "Company Admin",
    farmId: await upsertFarm(pmsId, "SR-1", "SR-1 Farm"),
  });

  const sr1Id = (await prisma.farm.findUniqueOrThrow({
    where: { companyId_code: { companyId: pmsId, code: "SR-1" } },
    select: { id: true },
  })).id;

  await upsertSheds(sr1Id, 12);
  await provisionUser({
    employeeId: pmsAdminEmpId,
    email: demoEmail("pms.admin"),
    role: "Company Admin",
  });

  const sr1DgmEmpId = await upsertEmployee({
    employeeId: "EMP001",
    name: "System DGM",
    phone: seedDgmPhone,
    designation: "DGM",
    farmId: sr1Id,
  });
  const sr1DgmUserId = await provisionUser({
    employeeId: sr1DgmEmpId,
    email: seedDgmEmail,
    role: "DGM",
  });

  const sr1AccEmpId = await upsertEmployee({
    employeeId: "EMP002",
    name: "SR-1 Accountant",
    phone: "919000000002",
    designation: "Accountant",
    farmId: sr1Id,
  });
  await provisionUser({
    employeeId: sr1AccEmpId,
    email: demoEmail("sr1.accountant"),
    role: "Accountant",
  });

  const sr1SupEmpId = await upsertEmployee({
    employeeId: "EMP003",
    name: "SR-1 Supervisor",
    phone: "919000000003",
    designation: "Supervisor",
    farmId: sr1Id,
  });
  const sr1SupUserId = await provisionUser({
    employeeId: sr1SupEmpId,
    email: demoEmail("sr1.supervisor"),
    role: "Supervisor",
  });

  const sr1Worker1 = await upsertWorker({
    workerId: "SR1-W001",
    name: "Ramesh Kumar",
    phone: "919000001001",
    farmId: sr1Id,
  });
  const sr1Worker2 = await upsertWorker({
    workerId: "SR1-W002",
    name: "Suresh Rao",
    phone: "919000001002",
    farmId: sr1Id,
  });

  await upsertEmployeeAttendance({
    date: day1,
    employeeId: sr1SupEmpId,
    farmId: sr1Id,
    status: "PRESENT",
    shift: "MORNING_SHIFT",
    latitude: 12.9716,
    longitude: 77.5946,
    recordedById: sr1DgmUserId,
  });
  await upsertWorkerAttendance({
    date: day1,
    workerId: sr1Worker1,
    farmId: sr1Id,
    status: "PRESENT",
    shift: "MORNING_SHIFT",
    latitude: 12.9716,
    longitude: 77.5946,
    recordedById: sr1SupUserId,
    approvedById: sr1DgmUserId,
  });
  await upsertWorkerAttendance({
    date: day1,
    workerId: sr1Worker2,
    farmId: sr1Id,
    status: "ABSENT",
    shift: "MORNING_SHIFT",
    latitude: 12.9716,
    longitude: 77.5946,
    recordedById: sr1DgmUserId,
  });
  await upsertWorkerAttendance({
    date: day2,
    workerId: sr1Worker1,
    farmId: sr1Id,
    status: "HALF_DAY",
    shift: "MORNING_SHIFT",
    latitude: 12.9716,
    longitude: 77.5946,
    recordedById: sr1DgmUserId,
  });

  const sr2Id = await upsertFarm(pmsId, "SR-2", "SR-2 Farm");
  await upsertSheds(sr2Id, 6);

  const sr2DgmEmpId = await upsertEmployee({
    employeeId: "EMP101",
    name: "SR-2 DGM",
    phone: "919000000101",
    designation: "DGM",
    farmId: sr2Id,
  });
  const sr2DgmUserId = await provisionUser({
    employeeId: sr2DgmEmpId,
    email: demoEmail("sr2.dgm"),
    role: "DGM",
  });

  const sr2Worker1 = await upsertWorker({
    workerId: "SR2-W001",
    name: "Mahesh Singh",
    phone: "919000002001",
    farmId: sr2Id,
  });

  await upsertWorkerAttendance({
    date: day1,
    workerId: sr2Worker1,
    farmId: sr2Id,
    status: "PRESENT",
    shift: "MORNING_SHIFT",
    latitude: 12.9716,
    longitude: 77.5946,
    recordedById: sr2DgmUserId,
  });

  const gnfId = await upsertCompany("GNF", "Green Nest Farms");
  const gn1Id = await upsertFarm(gnfId, "GN-1", "GN-1 Farm");
  await upsertSheds(gn1Id, 8);

  const gnfAdminEmpId = await upsertEmployee({
    employeeId: "GNF-ADMIN",
    name: "GNF Company Admin",
    phone: "919000000201",
    designation: "Company Admin",
    farmId: gn1Id,
  });
  await provisionUser({
    employeeId: gnfAdminEmpId,
    email: demoEmail("gnf.admin"),
    role: "Company Admin",
  });

  const gn1DgmEmpId = await upsertEmployee({
    employeeId: "GNF101",
    name: "GN-1 DGM",
    phone: "919000000202",
    designation: "DGM",
    farmId: gn1Id,
  });
  const gn1DgmUserId = await provisionUser({
    employeeId: gn1DgmEmpId,
    email: demoEmail("gn1.dgm"),
    role: "DGM",
  });

  const gn1Worker1 = await upsertWorker({
    workerId: "GN1-W001",
    name: "Arjun Patel",
    phone: "919000003001",
    farmId: gn1Id,
  });

  await upsertEmployeeAttendance({
    date: day1,
    employeeId: gn1DgmEmpId,
    farmId: gn1Id,
    status: "PRESENT",
    shift: "MORNING_SHIFT",
    latitude: 12.9716,
    longitude: 77.5946,
    recordedById: gn1DgmUserId,
  });
  await upsertWorkerAttendance({
    date: day1,
    workerId: gn1Worker1,
    farmId: gn1Id,
    status: "PRESENT",
    shift: "MORNING_SHIFT",
    latitude: 12.9716,
    longitude: 77.5946,
    recordedById: gn1DgmUserId,
  });
  */

  console.log("🌱 Database seed completed successfully (roles, designations & permissions only).");
}

main()
  .catch((error) => {
    console.error("❌ Database seed failed:");
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
