import { apiClient } from "./client.js";
import type {
  Farm,
  FarmStatus,
  Pagination,
  Shift,
  ShiftTimingItem,
  FarmRolesConfigResponse,
  CustomRoleConfigItem,
} from "./types.js";

export interface FarmListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: FarmStatus;
  companyId?: string;
}

export interface FarmListResponse {
  farms: Farm[];
  pagination: Pagination;
}

export interface FarmInput {
  name: string;
  code: string;
  companyId: string;
  status?: FarmStatus;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadius?: number | null;
  autoAbsentEnabled?: boolean;
  autoAbsentGraceMinutes?: number;
}

export function fetchFarms(query?: any, signal?: AbortSignal): Promise<Farm[]> {
  const q =
    typeof query === "string"
      ? query.trim()
        ? { status: query.trim() }
        : undefined
      : query;
  return apiClient.get("/farms", { query: q, signal }).then((res: any) => res.farms);
}

export function fetchFarm(id: string): Promise<Farm> {
  return apiClient.get(`/farms/${id}`).then((res: any) => res.farm);
}

export function setFarmActive(id: string, active: boolean): Promise<Farm> {
  return apiClient
    .patch(`/farms/${id}`, { status: active ? "ACTIVE" : "INACTIVE" })
    .then((res: any) => res.farm);
}

export function createFarm(data: FarmInput): Promise<Farm> {
  return apiClient.post("/farms", data).then((res: any) => res.farm);
}

export function updateFarm(id: string, data: Partial<FarmInput>): Promise<Farm> {
  return apiClient.patch(`/farms/${id}`, data).then((res: any) => res.farm);
}

// -- Farm Shift Timings --
export function fetchFarmShiftTimings(farmId: string): Promise<ShiftTimingItem[]> {
  return apiClient.get(`/farms/${farmId}/shift-timings`).then((res: any) => res.shifts);
}

export function updateFarmShiftTiming(
  farmId: string,
  shift: Shift,
  input: {
    label?: string;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    crossesMidnight?: boolean;
    isEnabled?: boolean;
  },
): Promise<ShiftTimingItem> {
  return apiClient
    .put(`/farms/${farmId}/shift-timings/${shift}`, input)
    .then((res: any) => res.timing);
}

export function resetFarmShiftTiming(farmId: string, shift: Shift): Promise<ShiftTimingItem> {
  return apiClient
    .delete(`/farms/${farmId}/shift-timings/${shift}`)
    .then((res: any) => res.timing);
}

// -- Farm Roles Configuration & Custom Roles --
export function fetchFarmRolesConfig(farmId: string): Promise<FarmRolesConfigResponse> {
  return apiClient.get(`/farms/${farmId}/roles-config`).then((res: any) => res);
}

export function toggleFarmSystemRole(
  farmId: string,
  roleId: string,
  isEnabled: boolean,
): Promise<any> {
  return apiClient.patch(`/farms/${farmId}/roles/${roleId}/toggle`, { isEnabled });
}

export function createFarmCustomRole(
  farmId: string,
  input: { name: string; description?: string; permissionIds: string[]; rank?: number },
): Promise<CustomRoleConfigItem> {
  return apiClient.post(`/farms/${farmId}/roles`, input).then((res: any) => res.role);
}

export function updateFarmCustomRole(
  farmId: string,
  roleId: string,
  input: {
    name?: string;
    description?: string;
    permissionIds?: string[];
    rank?: number;
    isActive?: boolean;
  },
): Promise<CustomRoleConfigItem> {
  return apiClient.patch(`/farms/${farmId}/roles/${roleId}`, input).then((res: any) => res.role);
}

export function deleteFarmCustomRole(farmId: string, roleId: string): Promise<any> {
  return apiClient.delete(`/farms/${farmId}/roles/${roleId}`);
}
