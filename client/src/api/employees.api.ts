import { apiClient, API_BASE_URL, ApiError } from "./client.js";
import type { Employee, EmployeeStatus, Pagination } from "./types.js";

export interface EmployeeListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: EmployeeStatus | "";
  designationId?: string;
  farmId?: string;
  sortBy?: "employeeId" | "name" | "status" | "login";
  sortOrder?: "asc" | "desc";
}

export interface EmployeeListResponse {
  employees: Employee[];
  pagination: Pagination;
}

export interface EmployeeInput {
  name: string;
  employeeId?: string | undefined;
  farmId?: string | undefined;
  designationId: string;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  photoUrl?: string | null | undefined;
  joiningDate?: string | null | undefined;
  status?: EmployeeStatus | undefined;
}

export type EmployeeListResult = EmployeeListResponse;

export interface ExcelImportSummary {
  totalCount: number;
  addedCount: number;
  failedCount: number;
  failedExcelBase64?: string;
  filename?: string;
}

export function fetchEmployees(
  query: EmployeeListQuery,
  signal?: AbortSignal,
): Promise<EmployeeListResult> {
  return apiClient.get("/employees", { query, signal });
}

export function fetchEmployee(id: string): Promise<Employee> {
  return apiClient.get(`/employees/${id}`).then((res: any) => res.employee);
}

export function setEmployeeActive(id: string, active: boolean): Promise<Employee> {
  return apiClient
    .patch(`/employees/${id}`, { status: active ? "ACTIVE" : "INACTIVE" })
    .then((res: any) => res.employee);
}

export function createEmployee(data: EmployeeInput, photo?: File | Blob | null): Promise<Employee> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    });
    formData.append("photo", photo, "employee.jpg");
    return fetch(`${API_BASE_URL}/employees`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          res.status,
          payload.message || "Failed to create employee",
          payload.errors,
          payload.formErrors,
        );
      }
      return payload.employee;
    });
  }
  return apiClient.post("/employees", data).then((res: any) => res.employee);
}

export function updateEmployee(
  id: string,
  data: Partial<EmployeeInput>,
  photo?: File | Blob | null,
): Promise<Employee> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    });
    formData.append("photo", photo, "employee.jpg");
    return fetch(`${API_BASE_URL}/employees/${id}`, {
      method: "PATCH",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          res.status,
          payload.message || "Failed to update employee",
          payload.errors,
          payload.formErrors,
        );
      }
      return payload.employee;
    });
  }
  return apiClient.patch(`/employees/${id}`, data).then((res: any) => res.employee);
}

export function provisionEmployeeUser(
  id: string,
  data?: { email: string; roleId: string; password?: string | undefined },
): Promise<any> {
  return apiClient.post(`/employees/${id}/user`, data);
}

export function updateEmployeeUserRole(
  id: string,
  roleId: string,
): Promise<{ success: boolean; message: string; employee: Employee }> {
  return apiClient.patch(`/employees/${id}/user/role`, { roleId });
}

export function deleteEmployee(id: string): Promise<{ success: boolean; message: string }> {
  return apiClient.delete(`/employees/${id}`);
}

export function importEmployeesExcel(
  file: File,
): Promise<{ success: boolean; message: string; summary: ExcelImportSummary }> {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${API_BASE_URL}/employees/import-excel`, {
    method: "POST",
    credentials: "include",
    body: formData,
  }).then(async (res) => {
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(
        res.status,
        payload.message || "Failed to import employees",
        payload.errors,
        payload.formErrors,
      );
    }
    return payload;
  });
}

export function downloadEmployeeTemplateUrl(): string {
  return `${API_BASE_URL}/employees/import-template`;
}
