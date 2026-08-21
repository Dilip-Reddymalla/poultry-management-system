import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import argon2 from "argon2";

// const prisma = new PrismaClient();

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

  // COMPANY

  const company = await prisma.company.upsert({
    where: {
      code: "PMS",
    },
    update: {},
    create: {
      code: "PMS",
      name: "Poultry Management Company",
    },
  });

  console.log(`✅ Company: ${company.name}`);

  // FARM

  const farm = await prisma.farm.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "SR-1",
      },
    },
    update: {},
    create: {
      companyId: company.id,
      code: "SR-1",
      name: "SR-1 Farm",
    },
  });

  console.log(`✅ Farm: ${farm.name}`);

  // SHEDS

  const shedNumbers = [
    "Shed-1",
    "Shed-2",
    "Shed-3",
    "Shed-4",
    "Shed-5",
    "Shed-6",
    "Shed-7",
    "Shed-8",
    "Shed-9",
    "Shed-10",
    "Shed-11",
    "Shed-12",
  ];

  for (const number of shedNumbers) {
    await prisma.shed.upsert({
      where: {
        farmId_number: {
          farmId: farm.id,
          number,
        },
      },
      update: {},
      create: {
        farmId: farm.id,
        number,
        capacity: 0,
      },
    });
  }

  console.log(`✅ Created/verified ${shedNumbers.length} sheds`);

  // DESIGNATIONS

  const designations = [
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

  // ROLES

  const roles = [
    {
      name: "DGM",
      description: "Full system access",
    },
    {
      name: "Assistant Manager",
      description: "Broad operational management access",
    },
    {
      name: "Super Incharge",
      description: "Broad farm operational access",
    },
    {
      name: "Incharge",
      description: "Operational supervision access",
    },
    {
      name: "Supervisor",
      description: "Assigned shed and operational access",
    },
    {
      name: "Accountant",
      description: "Administrative and accounting access",
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
      },
      create: role,
    });
  }

  console.log(`✅ Created/verified ${roles.length} roles`);

  // PERMISSIONS

  const permissions = [
    {
      name: "employee:view",
      description: "View employee information",
    },
    {
      name: "employee:create",
      description: "Create employees",
    },
    {
      name: "employee:update",
      description: "Update employee information",
    },
    {
      name: "employee:deactivate",
      description: "Deactivate employees",
    },
    {
      name: "employee:reactivate",
      description: "Reactivate employees",
    },

    {
      name: "attendance:view",
      description: "View attendance",
    },
    {
      name: "attendance:create",
      description: "Create attendance records",
    },
    {
      name: "attendance:update",
      description: "Update attendance records",
    },

    {
      name: "production:view",
      description: "View production records",
    },
    {
      name: "production:create",
      description: "Create production records",
    },
    {
      name: "production:update",
      description: "Update production records",
    },

    {
      name: "batch:create",
      description: "Create batches",
    },
    {
      name: "batch:view",
      description: "View batches",
    },
    {
      name: "batch:update",
      description: "Update batches",
    },

    {
      name: "approval:view",
      description: "View approval requests",
    },
    {
      name: "approval:approve",
      description: "Approve requests",
    },
    {
      name: "approval:reject",
      description: "Reject requests",
    },

    {
      name: "report:view",
      description: "View reports",
    },
    {
      name: "report:export",
      description: "Export reports",
    },

    {
      name: "farm:view",
      description: "View farms",
    },
    {
      name: "shed:view",
      description: "View sheds",
    },

    {
      name: "user:create",
      description: "Provision login accounts for employees",
    },
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

  const seedDgmEmail = process.env.SEED_DGM_EMAIL;
  const seedDgmPassword = process.env.SEED_DGM_PASSWORD;
  const seedDgmPhone = process.env.SEED_DGM_PHONE;

  if (!seedDgmEmail || !seedDgmPassword || !seedDgmPhone) {
    throw new Error(
      "SEED_DGM_EMAIL, SEED_DGM_PASSWORD and SEED_DGM_PHONE are required for seeding.",
    );
  }

  const dgmDesignation = await prisma.designation.findUnique({
    where: {
      name: "DGM",
    },
  });

  if (!dgmDesignation) {
    throw new Error("DGM designation not found");
  }

  const dgmEmployee = await prisma.employee.upsert({
    where: {
      employeeId: "EMP001",
    },
    update: {
      name: "System DGM",
      phone: seedDgmPhone,
      desiginationId: dgmDesignation.id,
      status: "ACTIVE",
    },
    create: {
      employeeId: "EMP001",
      name: "System DGM",
      phone: seedDgmPhone,
      desiginationId: dgmDesignation.id,
      status: "ACTIVE",
    },
  });

  console.log(`✅ DGM Employee: ${dgmEmployee.employeeId}`);

  const dgmPasswordHash = await argon2.hash(seedDgmPassword);

  const dgmUser = await prisma.user.upsert({
    where: {
      email: seedDgmEmail,
    },
    update: {
      employeeId: dgmEmployee.id,
      passwordHash: dgmPasswordHash,
      isActive: true,
    },
    create: {
      employeeId: dgmEmployee.id,
      email: seedDgmEmail,
      passwordHash: dgmPasswordHash,
      isActive: true,
    },
  });

  console.log(`✅ DGM User: ${dgmUser.email}`);

  const dgmRole = await prisma.role.findUnique({
    where: {
      name: "DGM",
    },
  });

  if (!dgmRole) {
    throw new Error("DGM role not found");
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: dgmUser.id,
        roleId: dgmRole.id,
      },
    },
    update: {},
    create: {
      userId: dgmUser.id,
      roleId: dgmRole.id,
    },
  });

  console.log("✅ DGM role assigned");

  const allPermissions = await prisma.permission.findMany();

  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: dgmRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: dgmRole.id,
        permissionId: permission.id,
      },
    });
  }

  console.log(`✅ Assigned ${allPermissions.length} permissions to DGM`);

  // ROLE PERMISSION MATRIX (non-DGM roles)
  //
  // DGM is intentionally assigned every permission above and handled separately
  // so it stays full-authority as new permissions are introduced. The matrix
  // below only adds assignments; it never deletes existing role permissions.
  const rolePermissionMatrix: { role: string; permissions: string[] }[] = [
    {
      role: "Assistant Manager",
      permissions: [
        "employee:view",
        "employee:create",
        "employee:update",
        "employee:deactivate",
        "employee:reactivate",
        "user:create",
        "farm:view",
        "shed:view",
        "attendance:view",
        "attendance:create",
        "attendance:update",
        "production:view",
        "production:create",
        "production:update",
        "batch:view",
        "batch:create",
        "batch:update",
        "approval:view",
        "report:view",
        "report:export",
      ],
    },
    {
      role: "Super Incharge",
      permissions: [
        "employee:view",
        "farm:view",
        "shed:view",
        "attendance:view",
        "attendance:create",
        "attendance:update",
        "production:view",
        "production:create",
        "production:update",
        "batch:view",
        "batch:create",
        "batch:update",
        "approval:view",
        "report:view",
      ],
    },
    {
      role: "Incharge",
      permissions: [
        "employee:view",
        "farm:view",
        "shed:view",
        "attendance:view",
        "attendance:create",
        "attendance:update",
        "production:view",
        "production:create",
        "production:update",
        "batch:view",
        "batch:update",
        "report:view",
      ],
    },
    {
      role: "Supervisor",
      permissions: [
        "farm:view",
        "shed:view",
        "attendance:view",
        "attendance:create",
        "production:view",
        "production:create",
        "batch:view",
      ],
    },
    {
      role: "Accountant",
      permissions: [
        "employee:view",
        "employee:deactivate",
        "employee:reactivate",
        "farm:view",
        "shed:view",
        "attendance:view",
        "production:view",
        "report:view",
        "report:export",
      ],
    },
  ];

  for (const entry of rolePermissionMatrix) {
    const role = await prisma.role.findUnique({
      where: {
        name: entry.role,
      },
    });

    if (!role) {
      throw new Error(`${entry.role} role not found`);
    }

    for (const name of entry.permissions) {
      const permission = await prisma.permission.findUnique({
        where: { name },
      });

      if (!permission) {
        throw new Error(`${name} permission not found`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    console.log(
      `✅ Assigned ${entry.permissions.length} permissions to ${entry.role}`,
    );
  }

  console.log("🌱 Database seed completed successfully.");
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
