import "dotenv/config";
import {PrismaPg} from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

const connectionString = process.env.DataBASE_URL;

if(!connectionString){
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
})

const prisma = new PrismaClient({
  adapter,
})

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