import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit/audit.service.js";
import type { AuthScope } from "../auth/scope.js";
import { assertCompanyWritable, invalidateScopeCache, isCompanyInScope } from "../auth/scope.js";

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
}

export interface CompanyRolesConfigResponse {
  companyId: string;
  systemRoles: CompanyRoleConfigItem[];
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

  // Fetch all generic system roles
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
    };
  });

  return { companyId, systemRoles };
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
