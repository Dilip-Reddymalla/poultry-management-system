import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { ScopeLevel } from "@prisma/client";

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
    "Asst Incharge",
    "Accountant",
    "Accounts Assistant",
    "Stores Executive",
    "Senior Supervisor",
    "Supervisor",
    "AC Supervisor",
    "AC Asst Supervisor",
    "Maintenance Supervisor",
    "Grading Supervisor",
    "Supervisor - Litter Maintenance",
    "Security Supervisor",
    "Asst Supervisor",
    "Asst Supervisor General",
    "Asst Supervisor - Technical",
    "Asst Supervisor - Electrical",
    "Security Head Guard",
    "Security Guard",
    "Senior Driver",
    "Driver",
    "Worker",
  ];

  for (const name of designations) {
    await prisma.designation.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(`✅ Created/verified ${designations.length} designations`);


  // ROLES -------------------------------------------------------------------
  //
  // scopeLevel is WHERE the role's permissions apply, relative to the user's own
  // company/farm. Company Admin is COMPANY-wide; operational roles are
  // FARM-scoped. The System Admin is env-based and global, so no role is GLOBAL.

  const roles: { name: string; description: string; scopeLevel: ScopeLevel }[] =
    [
      // Executive / Farm Management
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
        description: "Broad operational management, workforce oversight & approvals within farm",
        scopeLevel: "FARM",
      },

      // Finance & Administration
      {
        name: "Accountant",
        description: "Administrative, workforce management and accounting access",
        scopeLevel: "FARM",
      },
      {
        name: "Accounts Assistant",
        description: "Assists with accounting, record keeping and reporting",
        scopeLevel: "FARM",
      },
      {
        name: "Stores Executive",
        description: "Farm inventory, stores and supplies oversight",
        scopeLevel: "FARM",
      },

      // Incharge Level
      {
        name: "Super Incharge",
        description: "Broad farm operational access and department oversight",
        scopeLevel: "FARM",
      },
      {
        name: "Incharge",
        description: "Operational department incharge with workforce supervision",
        scopeLevel: "FARM",
      },
      {
        name: "Asst Incharge",
        description: "Assistant incharge for operational workflows",
        scopeLevel: "FARM",
      },

      // Supervisory Level
      {
        name: "Senior Supervisor",
        description: "Senior operational supervisor overseeing sheds and farm staff",
        scopeLevel: "FARM",
      },
      {
        name: "Supervisor",
        description: "Assigned shed and workforce operational supervision",
        scopeLevel: "FARM",
      },
      {
        name: "AC Supervisor",
        description: "Supervises climate control, AC and shed ventilation systems",
        scopeLevel: "FARM",
      },
      {
        name: "AC Asst Supervisor",
        description: "Assists with climate control and AC systems maintenance",
        scopeLevel: "FARM",
      },
      {
        name: "Maintenance Supervisor",
        description: "Supervises mechanical, electrical and structural maintenance",
        scopeLevel: "FARM",
      },
      {
        name: "Grading Supervisor",
        description: "Supervises poultry and egg grading operations",
        scopeLevel: "FARM",
      },
      {
        name: "Supervisor - Litter Maintenance",
        description: "Supervises shed sanitation and litter maintenance",
        scopeLevel: "FARM",
      },
      {
        name: "Security Supervisor",
        description: "Supervises farm perimeter and facility security operations",
        scopeLevel: "FARM",
      },

      // Assistant Supervisors
      {
        name: "Asst Supervisor",
        description: "General assistant supervisor for farm operations",
        scopeLevel: "FARM",
      },
      {
        name: "Asst Supervisor General",
        description: "Assists with general shed and farm operations",
        scopeLevel: "FARM",
      },
      {
        name: "Asst Supervisor - Technical",
        description: "Assists with technical machinery and automation systems",
        scopeLevel: "FARM",
      },
      {
        name: "Asst Supervisor - Electrical",
        description: "Assists with electrical equipment and power infrastructure",
        scopeLevel: "FARM",
      },

      // Security & Transport Staff Roles
      {
        name: "Security Head Guard",
        description: "Lead security guard for farm gates and premises",
        scopeLevel: "FARM",
      },
      {
        name: "Security Guard",
        description: "Security personnel for farm access control",
        scopeLevel: "FARM",
      },
      {
        name: "Senior Driver",
        description: "Senior logistics and transport driver",
        scopeLevel: "FARM",
      },
      {
        name: "Driver",
        description: "Logistics and transport driver",
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
    { name: "employee:delete", description: "Delete employees" },

    { name: "worker:view", description: "View workers" },
    { name: "worker:create", description: "Create workers" },
    { name: "worker:update", description: "Update workers" },
    { name: "worker:delete", description: "Delete workers" },

    { name: "attendance:view", description: "View attendance" },
    { name: "attendance:create", description: "Record attendance" },
    { name: "attendance:update", description: "Correct attendance records" },
    { name: "attendance:approve", description: "Approve/finalize attendance" },

    { name: "user:create", description: "Provision login accounts for employees" },
    { name: "user:update-role", description: "Change login role for employee accounts" },

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

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    for (const name of permissionNames) {
      const permissionId = permissionByName.get(name);

      if (!permissionId) {
        throw new Error(`${name} permission not found`);
      }

      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId },
      });
    }
  }

  // ROLE → PERMISSION MATRIX ------------------------------------------------

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
    "employee:delete",
    "worker:view",
    "worker:create",
    "worker:update",
    "worker:delete",
    "user:create",
    "user:update-role",
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
      role: "Accountant",
      permissions: [
        "farm:view",
        "shed:view",
        "employee:view",
        "employee:create",
        "employee:update",
        "employee:deactivate",
        "employee:reactivate",
        "employee:delete",
        "worker:view",
        "worker:create",
        "worker:update",
        "worker:delete",
        "attendance:view",
        "attendance:create",
        "report:view",
        "report:export",
      ],
    },
    {
      role: "Accounts Assistant",
      permissions: [
        "farm:view",
        "shed:view",
        "employee:view",
        "employee:update",
        "worker:view",
        "worker:update",
        "attendance:view",
        "attendance:create",
        "report:view",
      ],
    },
    {
      role: "Stores Executive",
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
      role: "Super Incharge",
      permissions: [
        "farm:view",
        "shed:view",
        "shed:update-status",
        "employee:view",
        "employee:update",
        "worker:view",
        "worker:create",
        "worker:update",
        "user:create",
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
        "employee:update",
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
      role: "Asst Incharge",
      permissions: [
        "farm:view",
        "shed:view",
        "employee:view",
        "employee:update",
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
      role: "Senior Supervisor",
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
      role: "AC Supervisor",
      permissions: [
        "farm:view",
        "shed:view",
        "shed:update-status",
        "employee:view",
        "worker:view",
        "attendance:view",
        "attendance:create",
        "report:view",
      ],
    },
    {
      role: "AC Asst Supervisor",
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
      role: "Maintenance Supervisor",
      permissions: [
        "farm:view",
        "shed:view",
        "shed:update-status",
        "employee:view",
        "worker:view",
        "attendance:view",
        "attendance:create",
        "report:view",
      ],
    },
    {
      role: "Grading Supervisor",
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
      role: "Supervisor - Litter Maintenance",
      permissions: [
        "farm:view",
        "shed:view",
        "shed:update-status",
        "employee:view",
        "worker:view",
        "attendance:view",
        "attendance:create",
        "report:view",
      ],
    },
    {
      role: "Security Supervisor",
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
      role: "Asst Supervisor",
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
      role: "Asst Supervisor General",
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
      role: "Asst Supervisor - Technical",
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
      role: "Asst Supervisor - Electrical",
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
      role: "Security Head Guard",
      permissions: [
        "farm:view",
        "shed:view",
        "employee:view",
        "worker:view",
      ],
    },
    {
      role: "Security Guard",
      permissions: [
        "farm:view",
        "shed:view",
        "worker:view",
      ],
    },
    {
      role: "Senior Driver",
      permissions: [
        "farm:view",
        "shed:view",
        "worker:view",
      ],
    },
    {
      role: "Driver",
      permissions: [
        "farm:view",
        "shed:view",
        "worker:view",
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

  console.log(
    "🌱 Database seed completed successfully (roles, designations & permissions only).",
  );
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
