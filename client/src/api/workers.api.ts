import { apiClient, API_BASE_URL, ApiError } from "./client.js";
import type { Worker, WorkerStatus, Employee, Pagination } from "./types.js";
import type { ExcelImportSummary } from "./employees.api.js";

export interface WorkerListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: WorkerStatus | "";
  farmId?: string;
  sortBy?: "workerId" | "name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface WorkerListResponse {
  workers: Worker[];
  pagination: Pagination;
}

export interface WorkerInput {
  name: string;
  workerId?: string | undefined;
  farmId?: string | undefined;
  phone?: string | null | undefined;
  status?: WorkerStatus | undefined;
}

export interface PromoteWorkerInput {
  designationId: string;
  employeeId?: string | undefined;
  joiningDate?: string | undefined;
  name?: string | undefined;
  phone?: string | undefined;
}

export type WorkerListResult = WorkerListResponse;

export function fetchWorkers(
  query: WorkerListQuery,
  signal?: AbortSignal,
): Promise<WorkerListResult> {
  return apiClient.get("/workers", { query, signal });
}

export function fetchWorker(id: string): Promise<Worker> {
  return apiClient.get(`/workers/${id}`).then((res: any) => res.worker);
}

export function setWorkerActive(id: string, active: boolean): Promise<Worker> {
  return apiClient
    .patch(`/workers/${id}`, { status: active ? "ACTIVE" : "INACTIVE" })
    .then((res: any) => res.worker);
}

export function createWorker(data: WorkerInput, photo?: File | Blob | null): Promise<Worker> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    });
    formData.append("photo", photo, "worker.jpg");
    return fetch(`${API_BASE_URL}/workers`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          res.status,
          payload.message || "Failed to create worker",
          payload.errors,
          payload.formErrors,
        );
      }
      return payload.worker;
    });
  }
  return apiClient.post("/workers", data).then((res: any) => res.worker);
}

export function updateWorker(
  id: string,
  data: Partial<WorkerInput>,
  photo?: File | Blob | null,
): Promise<Worker> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    });
    formData.append("photo", photo, "worker.jpg");
    return fetch(`${API_BASE_URL}/workers/${id}`, {
      method: "PATCH",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          res.status,
          payload.message || "Failed to update worker",
          payload.errors,
          payload.formErrors,
        );
      }
      return payload.worker;
    });
  }
  return apiClient.patch(`/workers/${id}`, data).then((res: any) => res.worker);
}

export function deleteWorker(id: string): Promise<{ success: boolean; message: string }> {
  return apiClient.delete(`/workers/${id}`);
}

export function promoteWorker(
  id: string,
  data: PromoteWorkerInput,
): Promise<{ success: boolean; message: string; employee: Employee }> {
  return apiClient.post(`/workers/${id}/promote`, data);
}

export function importWorkersExcel(
  file: File,
): Promise<{ success: boolean; message: string; summary: ExcelImportSummary }> {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${API_BASE_URL}/workers/import-excel`, {
    method: "POST",
    credentials: "include",
    body: formData,
  }).then(async (res) => {
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(
        res.status,
        payload.message || "Failed to import workers",
        payload.errors,
        payload.formErrors,
      );
    }
    return payload;
  });
}

export function downloadWorkerTemplateUrl(): string {
  return `${API_BASE_URL}/workers/import-template`;
}
