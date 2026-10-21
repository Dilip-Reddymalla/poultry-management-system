import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit/audit.service.js";
import type { AuthScope } from "../auth/scope.js";
import { assertFarmWritable, invalidateScopeCache } from "../auth/scope.js";

export interface SystemRoleConfigItem {
  id: string;
  name: string;
  description: string | null;
  scopeLevel: string;
  rank: number;
  isEnabled: boolean;
  companyEnabled: boolean;
  permissionCount: number;
}

export interface CustomRoleConfigItem {
  id: string;
  name: string;
  description: string | null;
  scopeLevel: string;
  rank: number;
  isActive: boolean;
  permissions: Array<{ id: string; name: string; description: string | null }>;
  userCount: number;
}

export interface FarmRolesConfigResponse {
  farmId: string;
  systemRoles: SystemRoleConfigItem[];
  customRoles: CustomRoleConfigItem[];
}

export async function getFarmRolesConfig(
  scope: AuthScope,
  farmId: string,
): Promise<FarmRolesConfigResponse> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true },
  });
  if (!farm) throw new AppError("Farm not found", 404);

  // 1. Fetch system roles with both company and farm settings
  const systemRolesRaw = await prisma.role.findMany({
    where: { isSystem: true },
    select: {
      id: true,
      name: true,
      description: true,
      scopeLevel: true,
      rank: true,
      permissions: { select: { permissionId: true } },
      companySettings: {
        where: { companyId: farm.companyId },
        select: { isEnabled: true, customRank: true },
      },
      farmSettings: {
        where: { farmId },
        select: { isEnabled: true },
      },
    },
    orderBy: { rank: "desc" },
  });

  // Farm inherits roles selected by the company
  const systemRoles: SystemRoleConfigItem[] = systemRolesRaw
    .map((r) => {
      const isCompanyAdmin = r.name === "Company Admin";
      const companyEnabled = isCompanyAdmin
        ? true
        : r.companySettings[0]
          ? r.companySettings[0].isEnabled
          : true;
      const farmEnabled = r.farmSettings[0] ? r.farmSettings[0].isEnabled : true;
      const effectiveRank = r.companySettings[0]?.customRank ?? r.rank;

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        scopeLevel: r.scopeLevel,
        rank: effectiveRank,
        isEnabled: companyEnabled && farmEnabled,
        companyEnabled,
        permissionCount: r.permissions.length,
      };
    })
    .filter((r) => r.companyEnabled);

  // 2. Fetch custom roles created for this farm
  const customRolesRaw = await prisma.role.findMany({
    where: { farmId, isSystem: false },
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
    orderBy: { name: "asc" },
  });

  const customRoles: CustomRoleConfigItem[] = customRolesRaw.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    scopeLevel: r.scopeLevel,
    rank: r.rank,
    isActive: r.isActive,
    permissions: r.permissions.map((p) => p.permission),
    userCount: r.users.length,
  }));

  return { farmId, systemRoles, customRoles };
}

export async function toggleFarmSystemRole(
  scope: AuthScope,
  farmId: string,
  roleId: string,
  isEnabled: boolean,
): Promise<{ success: boolean; roleId: string; isEnabled: boolean }> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true, name: true },
  });
  if (!farm) throw new AppError("Farm not found", 404);

  assertFarmWritable(scope, { id: farm.id, companyId: farm.companyId });

  const role = await prisma.role.findFirst({
    where: { id: roleId, isSystem: true },
    select: {
      id: true,
      name: true,
      companySettings: {
        where: { companyId: farm.companyId },
        select: { isEnabled: true },
      },
    },
  });
  if (!role) throw new AppError("System role not found", 404);

  const isCompanyEnabled =
    role.name === "Company Admin"
      ? true
      : role.companySettings[0]
        ? role.companySettings[0].isEnabled
        : true;

  if (!isCompanyEnabled && isEnabled) {
    throw new AppError(
      `Cannot enable "${role.name}" because it is not enabled for your company`,
      400,
    );
  }

  await prisma.farmRoleSetting.upsert({
    where: {
      farmId_roleId: { farmId, roleId },
    },
    update: { isEnabled },
    create: { farmId, roleId, isEnabled },
  });

  invalidateScopeCache();

  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "FarmRoleSetting",
    entityId: `${farmId}:${roleId}`,
    summary: `${isEnabled ? "Enabled" : "Disabled"} standard role ${role.name} on farm ${farm.name}`,
    changes: { roleId, roleName: role.name, isEnabled },
  });

  return { success: true, roleId, isEnabled };
}

export interface CreateCustomRoleInput {
  name: string;
  description?: string;
  permissionIds: string[];
  rank?: number;
}

export async function createFarmCustomRole(
  scope: AuthScope,
  farmId: string,
  input: CreateCustomRoleInput,
): Promise<CustomRoleConfigItem> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true, name: true },
  });
  if (!farm) throw new AppError("Farm not found", 404);

  assertFarmWritable(scope, { id: farm.id, companyId: farm.companyId });

  const name = input.name.trim();
  if (!name || name.length < 2) {
    throw new AppError("Role name must be at least 2 characters long", 400);
  }

  // Check for duplicate in this farm
  const existing = await prisma.role.findFirst({
    where: { name, farmId },
  });
  if (existing) {
    throw new AppError(`A role named "${name}" already exists on this farm`, 409);
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
      scopeLevel: "FARM",
      farmId,
      companyId: farm.companyId,
      isSystem: false,
      isActive: true,
      rank: roleRank,
      permissions: {
        create: input.permissionIds.map((permissionId) => ({
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

  void recordAuditLog({
    scope,
    action: "CREATE",
    entity: "Role",
    entityId: newRole.id,
    summary: `Created custom role ${newRole.name} for farm ${farm.name}`,
    changes: { roleId: newRole.id, name: newRole.name, permissions: input.permissionIds },
  });

  return {
    id: newRole.id,
    name: newRole.name,
    description: newRole.description,
    scopeLevel: newRole.scopeLevel,
    rank: newRole.rank,
    isActive: newRole.isActive,
    permissions: newRole.permissions.map((p) => p.permission),
    userCount: 0,
  };
}

export interface UpdateCustomRoleInput {
  name?: string;
  description?: string;
  permissionIds?: string[];
  rank?: number;
  isActive?: boolean;
}

export async function updateFarmCustomRole(
  scope: AuthScope,
  farmId: string,
  roleId: string,
  input: UpdateCustomRoleInput,
): Promise<CustomRoleConfigItem> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true, name: true },
  });
  if (!farm) throw new AppError("Farm not found", 404);

  assertFarmWritable(scope, { id: farm.id, companyId: farm.companyId });

  const role = await prisma.role.findFirst({
    where: { id: roleId, farmId, isSystem: false },
  });
  if (!role) throw new AppError("Custom role not found on this farm", 404);

  await prisma.$transaction(async (tx) => {
    if (input.name || input.description !== undefined || input.rank !== undefined || input.isActive !== undefined) {
      await tx.role.update({
        where: { id: roleId },
        data: {
          ...(input.name && { name: input.name.trim() }),
          ...(input.description !== undefined && { description: input.description.trim() || null }),
          ...(input.rank !== undefined && { rank: input.rank }),
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
    isActive: updated.isActive,
    permissions: updated.permissions.map((p) => p.permission),
    userCount: updated.users.length,
  };
}

export async function deleteFarmCustomRole(
  scope: AuthScope,
  farmId: string,
  roleId: string,
): Promise<{ success: boolean; id: string }> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true, name: true },
  });
  if (!farm) throw new AppError("Farm not found", 404);

  assertFarmWritable(scope, { id: farm.id, companyId: farm.companyId });

  const role = await prisma.role.findFirst({
    where: { id: roleId, farmId, isSystem: false },
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
    summary: `Deleted custom role ${role.name} on farm ${farm.name}`,
  });

  return { success: true, id: roleId };
}
