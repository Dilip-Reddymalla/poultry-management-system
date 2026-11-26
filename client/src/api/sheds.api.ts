import { apiClient } from "./client.js";
import type { Shed, ShedStatus, Pagination, ManageableShedStatus } from "./types.js";

export interface ShedListQuery {
  page?: number;
  limit?: number;
  farmId?: string;
  status?: ShedStatus;
}

export interface ShedListResponse {
  sheds: Shed[];
  pagination: Pagination;
}

export interface ShedInput {
  number: string;
  farmId: string;
  capacity?: number;
}

export function fetchSheds(query?: any, signal?: AbortSignal): Promise<Shed[]> {
  return apiClient.get("/sheds", { query, signal }).then((res: any) => res.sheds);
}

export function fetchShed(id: string): Promise<Shed> {
  return apiClient.get(`/sheds/${id}`).then((res: any) => res.shed);
}

export function createShed(data: ShedInput): Promise<Shed> {
  return apiClient.post("/sheds", data).then((res: any) => res.shed);
}

export function updateShed(id: string, data: Partial<ShedInput>): Promise<Shed> {
  return apiClient.patch(`/sheds/${id}`, data).then((res: any) => res.shed);
}

export function updateShedStatus(id: string, status: ManageableShedStatus): Promise<Shed> {
  return apiClient.patch(`/sheds/${id}/status`, { status }).then((res: any) => res.shed);
}
