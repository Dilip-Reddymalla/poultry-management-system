import { apiClient } from "./client.js";
import type { Designation, Role, Permission } from "./types.js";

export function fetchDesignations(
  farmId?: string,
  companyId?: string,
): Promise<Designation[]> {
  const query: Record<string, string> = {};
  if (farmId) query.farmId = farmId;
  if (companyId) query.companyId = companyId;
  const options = Object.keys(query).length > 0 ? { query } : undefined;
  return apiClient.get("/reference/designations", options).then((res: any) => res.designations);
}

export function fetchRoles(
  farmId?: string,
  companyId?: string,
): Promise<Role[]> {
  const query: Record<string, string> = {};
  if (farmId) query.farmId = farmId;
  if (companyId) query.companyId = companyId;
  const options = Object.keys(query).length > 0 ? { query } : undefined;
  return apiClient.get("/reference/roles", options).then((res: any) => res.roles);
}

export function fetchPermissions(): Promise<Permission[]> {
  return apiClient.get("/reference/permissions").then((res: any) => res.permissions);
}
