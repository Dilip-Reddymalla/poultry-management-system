import { prisma } from "../../config/database.js";

import type { SafeDesignation, SafeRole } from "./reference.types.js";

// Designations and roles are small fixed lookup tables, so they are returned as
// plain sorted lists — no pagination, per the list response standard. (Companies
// are a scoped, writable resource and live in their own module.)

export async function listDesignations(): Promise<SafeDesignation[]> {
  const designations = await prisma.designation.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  return designations.map((designation) => ({
    id: designation.id,
    name: designation.name,
  }));
}

export async function listRoles(): Promise<SafeRole[]> {
  const roles = await prisma.role.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
  }));
}
