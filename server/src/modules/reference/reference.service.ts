import { prisma } from "../../config/database.js";

import type { SafeDesignation, SafePermission, SafeRole } from "./reference.types.js";

// Designations and roles are returned as plain sorted lists — no pagination,
// per the list response standard. Roles are dynamically resolved according to
// farm/company scoping (enabled presets + custom tenant roles).

export async function listDesignations(
  farmId?: string,
  companyId?: string,
): Promise<SafeDesignation[]> {
  if (farmId || companyId) {
    const allowedRoles = await listRoles(farmId, companyId);
    const allowedNames = allowedRoles.map((r) => r.name);

    const designations = await prisma.designation.findMany({
      where: {
        name: { in: allowedNames },
      },
      select: {
        id: true,
        name: true,
      },
    });

    return designations
      .map((designation) => ({
        id: designation.id,
        name: designation.name,
      }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  const designations = await prisma.designation.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  return designations
    .map((designation) => ({
      id: designation.id,
      name: designation.name,
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export async function listRoles(
  farmId?: string,
  companyId?: string,
): Promise<SafeRole[]> {
  if (farmId) {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: { companyId: true },
    });
    if (!farm) return [];

    // 1. Fetch system roles with both company and farm settings
    const systemRoles = await prisma.role.findMany({
      where: { isSystem: true, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        rank: true,
        companySettings: {
          where: { companyId: farm.companyId },
          select: { isEnabled: true, customRank: true },
        },
        farmSettings: {
          where: { farmId },
          select: { isEnabled: true },
        },
      },
    });

    const activeSystemRoles = systemRoles
      .filter((r) => {
        // Company Admin is compulsory and always active
        const isCompanyEnabled =
          r.name === "Company Admin"
            ? true
            : r.companySettings.length === 0 || r.companySettings[0]?.isEnabled !== false;
        const isFarmEnabled =
          r.farmSettings.length === 0 || r.farmSettings[0]?.isEnabled !== false;

        return isCompanyEnabled && isFarmEnabled;
      })
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        rank: r.companySettings[0]?.customRank ?? r.rank,
      }));

    // 2. Fetch custom roles for this farm or company
    const customRoles = await prisma.role.findMany({
      where: {
        isSystem: false,
        isActive: true,
        OR: [
          { farmId },
          { companyId: farm.companyId, farmId: null },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        rank: true,
      },
    });

    return [...activeSystemRoles, ...customRoles].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
  }

  if (companyId) {
    // 1. Fetch system roles with company settings
    const systemRoles = await prisma.role.findMany({
      where: { isSystem: true, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        rank: true,
        companySettings: {
          where: { companyId },
          select: { isEnabled: true, customRank: true },
        },
      },
    });

    const activeSystemRoles = systemRoles
      .filter((r) => {
        return (
          r.name === "Company Admin" ||
          r.companySettings.length === 0 ||
          r.companySettings[0]?.isEnabled !== false
        );
      })
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        rank: r.companySettings[0]?.customRank ?? r.rank,
      }));

    // 2. Fetch custom roles for this company
    const customRoles = await prisma.role.findMany({
      where: {
        isSystem: false,
        isActive: true,
        companyId,
        farmId: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        rank: true,
      },
    });

    return [...activeSystemRoles, ...customRoles].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
  }

  // Fallback: list all active roles
  const roles = await prisma.role.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      rank: true,
    },
  });

  return roles
    .map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      rank: role.rank,
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export async function listPermissions(): Promise<SafePermission[]> {
  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });

  return permissions;
}

