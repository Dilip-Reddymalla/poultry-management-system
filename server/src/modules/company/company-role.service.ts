import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit/audit.service.js";
import type { AuthScope } from "../auth/scope.js";
import { assertCompanyWritable, invalidateScopeCache, isCompanyInScope } from "../auth/scope.js";

export interface RolePermissionDetail {
  id: string;
  name: string;
  description: string | null;
}

export interface CompanyRoleConfigItem {
  id: string;
  name: string;
  description: string | null;
  scopeLevel: string;
  rank: number;
  defaultRank: number;
  customRank: number | null;
  isEnabled: boolean;
  isCompulsory: boolean;
  permissionCount: number;
  isCustom: boolean;
  permissions: RolePermissionDetail[];
  userCount?: number;
}

export interface CompanyRolesConfigResponse {
  companyId: string;
  systemRoles: CompanyRoleConfigItem[];
  customRoles: CompanyRoleConfigItem[];
}

export async function getCompanyRolesConfig(
  scope: AuthScope,
  companyId: string,
): Promise<CompanyRolesConfigResponse> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company || !isCompanyInScope(scope, companyId)) {
    throw new AppError("Company not found", 404);
  }

  // 1. Fetch all generic system roles with permissions and company-specific settings
  const systemRolesRaw = await prisma.role.findMany({
    where: { isSystem: true },
    select: {
      id: true,
      name: true,
      description: true,
      scopeLevel: true,
      rank: true,
      permissions: {
        select: {
          permission: {
            select: { id: true, name: true, description: true },
          },
        },
      },
      companySettings: {
        where: { companyId },
        select: { isEnabled: true, customRank: true },
      },
    },
    orderBy: { rank: "desc" },
  });

  const systemRoles: CompanyRoleConfigItem[] = systemRolesRaw.map((r) => {
    const isCompanyAdmin = r.name === "Company Admin";
    const setting = r.companySettings[0];
    const isEnabled = isCompanyAdmin ? true : (setting ? setting.isEnabled : true);
    const customRank = setting?.customRank ?? null;
    const effectiveRank = customRank !== null && customRank !== undefined ? customRank : r.rank;

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      scopeLevel: r.scopeLevel,
      rank: effectiveRank,
      defaultRank: r.rank,
      customRank,
      isEnabled,
      isCompulsory: isCompanyAdmin,
      permissionCount: r.permissions.length,
      isCustom: false,
      permissions: r.permissions.map((p) => p.permission),
      userCount: 0,
    };
  });

  // 2. Fetch custom roles created specifically for this company
  const customRolesRaw = await prisma.role.findMany({
    where: { companyId, farmId: null, isSystem: false },
    select: {
      id: true,
      name: true,
      description: true,
      scopeLevel: true,
      rank: true,
      isActive: true,
      permissions: {
        select: {
          permission: {
            select: { id: true, name: true, description: true },
          },
        },
      },
      users: { select: { userId: true } },
    },
    orderBy: { rank: "desc" },
  });

  const customRoles: CompanyRoleConfigItem[] = customRolesRaw.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    scopeLevel: r.scopeLevel,
    rank: r.rank,
    defaultRank: r.rank,
    customRank: r.rank,
    isEnabled: r.isActive,
    isCompulsory: false,
    permissionCount: r.permissions.length,
    isCustom: true,
    permissions: r.permissions.map((p) => p.permission),
    userCount: r.users.length,
  }));

  return { companyId, systemRoles, customRoles };
}

export interface UpdateCompanyRoleInput {
  isEnabled?: boolean;
  customRank?: number | null;
}

export async function updateCompanyRole(
  scope: AuthScope,
  companyId: string,
  roleId: string,
  input: UpdateCompanyRoleInput,
): Promise<{ success: boolean; roleId: string; isEnabled: boolean; customRank: number | null }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError("Company not found", 404);

  assertCompanyWritable(scope, companyId);

  const role = await prisma.role.findFirst({
    where: { id: roleId, isSystem: true },
    select: { id: true, name: true },
  });
  if (!role) throw new AppError("System role not found", 404);

  // Invariant: Company Admin is a default and compulsory role. It can NEVER be disabled.
  if (role.name === "Company Admin" && input.isEnabled === false) {
    throw new AppError("Company Admin is a compulsory role and cannot be disabled", 400);
  }

  // Validate customRank if provided
  if (input.customRank !== undefined && input.customRank !== null) {
    if (typeof input.customRank !== "number" || input.customRank < 1 || input.customRank > 100) {
      throw new AppError("Custom rank must be an integer between 1 and 100", 400);
    }
  }

  const updated = await prisma.companyRoleSetting.upsert({
    where: {
      companyId_roleId: { companyId, roleId },
    },
    update: {
      ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
      ...(input.customRank !== undefined && { customRank: input.customRank }),
    },
    create: {
      companyId,
      roleId,
      isEnabled: input.isEnabled ?? true,
      customRank: input.customRank ?? null,
    },
  });

  invalidateScopeCache();

  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "CompanyRoleSetting",
    entityId: `${companyId}:${roleId}`,
    summary: `Updated role ${role.name} configuration for company ${company.name}`,
    changes: { roleId, roleName: role.name, ...input },
  });

  return {
    success: true,
    roleId,
    isEnabled: updated.isEnabled,
    customRank: updated.customRank,
  };
}

export async function toggleCompanyRole(
  scope: AuthScope,
  companyId: string,
  roleId: string,
  isEnabled: boolean,
): Promise<{ success: boolean; roleId: string; isEnabled: boolean; customRank: number | null }> {
  return updateCompanyRole(scope, companyId, roleId, { isEnabled });
}

export async function bulkToggleCompanyRoles(
  scope: AuthScope,
  companyId: string,
  enabled: boolean,
): Promise<{ success: boolean }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError("Company not found", 404);

  assertCompanyWritable(scope, companyId);

  // Fetch all system roles except Company Admin
  const nonCompulsoryRoles = await prisma.role.findMany({
    where: { isSystem: true, NOT: { name: "Company Admin" } },
    select: { id: true },
  });

  for (const role of nonCompulsoryRoles) {
    await prisma.companyRoleSetting.upsert({
      where: { companyId_roleId: { companyId, roleId: role.id } },
      update: { isEnabled: enabled },
      create: { companyId, roleId: role.id, isEnabled: enabled },
    });
  }

  invalidateScopeCache();

  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "CompanyRoleSetting",
    entityId: companyId,
    summary: `${enabled ? "Enabled" : "Disabled"} all optional standard roles for company ${company.name}`,
    changes: { enabled },
  });

  return { success: true };
}

export interface CompanyRoleHierarchyUpdateItem {
  roleId: string;
  isEnabled: boolean;
  customRank?: number | null | undefined;
}

export async function updateCompanyRolesHierarchy(
  scope: AuthScope,
  companyId: string,
  hierarchy: CompanyRoleHierarchyUpdateItem[],
): Promise<{ success: boolean; updatedCount: number }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError("Company not found", 404);

  assertCompanyWritable(scope, companyId);

  // Invariant: Company Admin is a compulsory role and cannot be disabled
  const companyAdminRole = await prisma.role.findFirst({
    where: { name: "Company Admin", isSystem: true },
    select: { id: true, rank: true },
  });

  if (companyAdminRole) {
    const adminSetting = hierarchy.find((h) => h.roleId === companyAdminRole.id);
    if (adminSetting && adminSetting.isEnabled === false) {
      throw new AppError("Company Admin is a compulsory role and cannot be disabled", 400);
    }
  }

  // Validate customRank if provided
  for (const item of hierarchy) {
    if (item.customRank !== undefined && item.customRank !== null) {
      if (typeof item.customRank !== "number" || item.customRank < 1 || item.customRank > 100) {
        throw new AppError("Custom rank must be an integer between 1 and 100", 400);
      }
    }
  }

  // Fetch the roles to differentiate between system roles and company custom roles
  const roleIds = hierarchy.map((h) => h.roleId);
  const existingRoles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { id: true, name: true, isSystem: true, companyId: true },
  });
  const roleMap = new Map(existingRoles.map((r) => [r.id, r]));

  // Transactionally update system roles settings and custom role records in parallel
  await prisma.$transaction(
    async (tx) => {
      await Promise.all(
        hierarchy.map((item) => {
          const role = roleMap.get(item.roleId);
          if (role && !role.isSystem && role.companyId === companyId) {
            return tx.role.update({
              where: { id: item.roleId },
              data: {
                isActive: item.isEnabled,
                ...(item.customRank !== undefined && item.customRank !== null ? { rank: item.customRank } : {}),
              },
            });
          }

          return tx.companyRoleSetting.upsert({
            where: {
              companyId_roleId: { companyId, roleId: item.roleId },
            },
            update: {
              isEnabled: item.isEnabled,
              customRank: item.customRank ?? null,
            },
            create: {
              companyId,
              roleId: item.roleId,
              isEnabled: item.isEnabled,
              customRank: item.customRank ?? null,
            },
          });
        }),
      );
    },
    { timeout: 45000, maxWait: 15000 },
  );

  invalidateScopeCache();


  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "CompanyRoleSetting",
    entityId: companyId,
    summary: `Updated role hierarchy and rank positions for company ${company.name}`,
    changes: { count: hierarchy.length },
  });

  return { success: true, updatedCount: hierarchy.length };
}

export interface CreateCompanyCustomRoleInput {
  name: string;
  description?: string | undefined;
  scopeLevel?: "COMPANY" | "FARM" | undefined;
  permissionIds: string[];
  rank?: number | undefined;
}

export async function createCompanyCustomRole(
  scope: AuthScope,
  companyId: string,
  input: CreateCompanyCustomRoleInput,
): Promise<CompanyRoleConfigItem> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError("Company not found", 404);

  assertCompanyWritable(scope, companyId);

  const name = input.name.trim();
  if (!name || name.length < 2) {
    throw new AppError("Role name must be at least 2 characters long", 400);
  }

  // Check for duplicate role in this company or system
  const existing = await prisma.role.findFirst({
    where: {
      name,
      OR: [
        { isSystem: true },
        { companyId, farmId: null },
      ],
    },
  });
  if (existing) {
    throw new AppError(`A role named "${name}" already exists in this company or standard roles`, 409);
  }

  // Ensure a Designation exists for this custom role
  await prisma.designation.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  const roleRank = input.rank ?? 30;

  const newRole = await prisma.role.create({
    data: {
      name,
      description: input.description?.trim() || null,
      scopeLevel: input.scopeLevel || "COMPANY",
      companyId,
      farmId: null,
      isSystem: false,
      isActive: true,
      rank: roleRank,
      permissions: {
        create: (input.permissionIds || []).map((permissionId) => ({
          permissionId,
        })),
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      scopeLevel: true,
      rank: true,
      isActive: true,
      permissions: {
        select: {
          permission: {
            select: { id: true, name: true, description: true },
          },
        },
      },
    },
  });

  invalidateScopeCache();

  void recordAuditLog({
    scope,
    action: "CREATE",
    entity: "Role",
    entityId: newRole.id,
    summary: `Created custom role ${newRole.name} for company ${company.name}`,
    changes: { roleId: newRole.id, name: newRole.name, permissions: input.permissionIds },
  });

  return {
    id: newRole.id,
    name: newRole.name,
    description: newRole.description,
    scopeLevel: newRole.scopeLevel,
    rank: newRole.rank,
    defaultRank: newRole.rank,
    customRank: newRole.rank,
    isEnabled: newRole.isActive,
    isCompulsory: false,
    permissionCount: newRole.permissions.length,
    isCustom: true,
    permissions: newRole.permissions.map((p) => p.permission),
    userCount: 0,
  };
}

export interface UpdateCompanyCustomRoleInput {
  name?: string | undefined;
  description?: string | undefined;
  scopeLevel?: "COMPANY" | "FARM" | undefined;
  permissionIds?: string[] | undefined;
  rank?: number | undefined;
  isActive?: boolean | undefined;
}


export async function updateCompanyCustomRole(
  scope: AuthScope,
  companyId: string,
  roleId: string,
  input: UpdateCompanyCustomRoleInput,
): Promise<CompanyRoleConfigItem> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError("Company not found", 404);

  assertCompanyWritable(scope, companyId);

  const role = await prisma.role.findFirst({
    where: { id: roleId, companyId, farmId: null, isSystem: false },
  });
  if (!role) throw new AppError("Custom role not found in this company", 404);

  if (input.name && input.name.trim() !== role.name) {
    const trimmedName = input.name.trim();
    const duplicate = await prisma.role.findFirst({
      where: {
        name: trimmedName,
        id: { not: roleId },
        OR: [{ isSystem: true }, { companyId, farmId: null }],
      },
    });
    if (duplicate) {
      throw new AppError(`A role named "${trimmedName}" already exists in this company`, 409);
    }
  }

  await prisma.$transaction(async (tx) => {
    if (
      input.name ||
      input.description !== undefined ||
      input.rank !== undefined ||
      input.isActive !== undefined ||
      input.scopeLevel !== undefined
    ) {
      await tx.role.update({
        where: { id: roleId },
        data: {
          ...(input.name && { name: input.name.trim() }),
          ...(input.description !== undefined && { description: input.description.trim() || null }),
          ...(input.rank !== undefined && { rank: input.rank }),
          ...(input.scopeLevel && { scopeLevel: input.scopeLevel }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });

      if (input.name) {
        const trimmedName = input.name.trim();
        await tx.designation.upsert({
          where: { name: trimmedName },
          update: {},
          create: { name: trimmedName },
        });
      }
    }

    if (input.permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: input.permissionIds.map((permissionId) => ({ roleId, permissionId })),
      });
    }
  });

  invalidateScopeCache();

  const updated = await prisma.role.findUniqueOrThrow({
    where: { id: roleId },
    select: {
      id: true,
      name: true,
      description: true,
      scopeLevel: true,
      rank: true,
      isActive: true,
      permissions: {
        select: {
          permission: {
            select: { id: true, name: true, description: true },
          },
        },
      },
      users: { select: { userId: true } },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    scopeLevel: updated.scopeLevel,
    rank: updated.rank,
    defaultRank: updated.rank,
    customRank: updated.rank,
    isEnabled: updated.isActive,
    isCompulsory: false,
    permissionCount: updated.permissions.length,
    isCustom: true,
    permissions: updated.permissions.map((p) => p.permission),
    userCount: updated.users.length,
  };
}

export async function deleteCompanyCustomRole(
  scope: AuthScope,
  companyId: string,
  roleId: string,
): Promise<{ success: boolean; id: string }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError("Company not found", 404);

  assertCompanyWritable(scope, companyId);

  const role = await prisma.role.findFirst({
    where: { id: roleId, companyId, farmId: null, isSystem: false },
    include: { users: true },
  });
  if (!role) throw new AppError("Custom role not found", 404);

  if (role.users.length > 0) {
    throw new AppError(
      `Cannot delete role "${role.name}" because it is currently assigned to ${role.users.length} active employee(s). Please reassign them first.`,
      409,
    );
  }

  await prisma.role.delete({ where: { id: roleId } });
  invalidateScopeCache();

  void recordAuditLog({
    scope,
    action: "DELETE",
    entity: "Role",
    entityId: roleId,
    summary: `Deleted custom role ${role.name} for company ${company.name}`,
  });

  return { success: true, id: roleId };
}

