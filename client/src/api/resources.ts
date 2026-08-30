import type {
  Attendance,
  AttendanceStatus,
  AuditLog,
  Shift,
  Company,
  Employee,
  EmployeeStatus,
  Farm,
  FarmStatus,
  Pagination,
  Shed,
  ShedStatus,
  Worker,
  WorkerStatus,
} from "./types.js";

// -- Companies --
export interface CompanyListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CompanyListResponse {
  companies: Company[];
  pagination: Pagination;
}

export interface CompanyInput {
  name: string;
  code: string;
  gstin?: string;
  pan?: string;
  address?: string;
}

// -- Farms --
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
}

// -- Sheds --
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

// -- Employees --
export interface EmployeeListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: EmployeeStatus | "";
  designationId?: string;
  farmId?: string;
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

// -- Workers --
export interface WorkerListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: WorkerStatus | "";
  farmId?: string;
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

// -- Attendance --
export interface AttendanceListQuery {
  page?: number;
  limit?: number;
  search?: string;
  date?: string;
  from?: string;
  to?: string;
  farmId?: string;
  shedId?: string;
  employeeId?: string;
  workerId?: string;
  status?: AttendanceStatus;
  shift?: Shift;
  recordedById?: string;
}

export interface AttendanceListResponse {
  attendance: Attendance[];
  pagination: Pagination;
}

export interface AttendanceInput {
  date: string;
  employeeId?: string;
  workerId?: string;
  shedId?: string;
  shift: Shift;
  status: AttendanceStatus;
  latitude: number;
  longitude: number;
  notes?: string;
}

export interface AttendanceCorrection {
  status?: AttendanceStatus;
  notes?: string | null;
}

export interface BulkAttendanceInput {
  records: AttendanceInput[];
}

export interface BulkAttendanceResponse {
  results: {
    status: "fulfilled" | "rejected";
    value?: Attendance;
    reason?: string;
    input?: AttendanceInput;
  }[];
}

export interface MarkedPersonIdsQuery {
  date: string;
  shift: Shift;
  farmId: string;
}

export interface MarkedPersonIdsResponse {
  employeeIds: string[];
  workerIds: string[];
}

export interface ExportAttendanceQuery {
  date?: string;
  from?: string;
  to?: string;
  farmId?: string;
  shedId?: string;
  scope?: "employees" | "workers" | "all";
}

import { apiClient, API_BASE_URL, ApiError } from "./client.js";
import type { Designation, Role, ManageableShedStatus } from "./types.js";

// -- Reference Data --
export function fetchDesignations(): Promise<Designation[]> {
  return apiClient.get("/reference/designations").then((res: any) => res.designations);
}
export function fetchRoles(): Promise<Role[]> {
  return apiClient.get("/reference/roles").then((res: any) => res.roles);
}

// -- Employees --
export type EmployeeListResult = EmployeeListResponse;
export function fetchEmployees(query: EmployeeListQuery, signal?: AbortSignal): Promise<EmployeeListResult> {
  return apiClient.get("/employees", { query, signal });
}
export function fetchEmployee(id: string): Promise<Employee> {
  return apiClient.get(`/employees/${id}`).then((res: any) => res.employee);
}
export function setEmployeeActive(id: string, active: boolean): Promise<Employee> {
  return apiClient.patch(`/employees/${id}`, { status: active ? "ACTIVE" : "INACTIVE" }).then((res: any) => res.employee);
}
export function createEmployee(data: EmployeeInput, photo?: File | Blob | null): Promise<Employee> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("photo", photo, "employee.jpg");
    return fetch(`${API_BASE_URL}/employees`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(res.status, payload.message || "Failed to create employee", payload.errors, payload.formErrors);
      }
      return payload.employee;
    });
  }
  return apiClient.post("/employees", data).then((res: any) => res.employee);
}
export function updateEmployee(id: string, data: Partial<EmployeeInput>, photo?: File | Blob | null): Promise<Employee> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("photo", photo, "employee.jpg");
    return fetch(`${API_BASE_URL}/employees/${id}`, {
      method: "PATCH",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(res.status, payload.message || "Failed to update employee", payload.errors, payload.formErrors);
      }
      return payload.employee;
    });
  }
  return apiClient.patch(`/employees/${id}`, data).then((res: any) => res.employee);
}
export function provisionEmployeeUser(id: string, data?: { email: string; roleId: string }): Promise<any> {
  return apiClient.post(`/employees/${id}/user`, data);
}

// -- Farms --
export function fetchFarms(query?: any, signal?: AbortSignal): Promise<Farm[]> {
  return apiClient.get("/farms", { query, signal }).then((res: any) => res.farms);
}
export function fetchFarm(id: string): Promise<Farm> {
  return apiClient.get(`/farms/${id}`).then((res: any) => res.farm);
}
export function setFarmActive(id: string, active: boolean): Promise<Farm> {
  return apiClient.patch(`/farms/${id}`, { status: active ? "ACTIVE" : "INACTIVE" }).then((res: any) => res.farm);
}
export function createFarm(data: FarmInput): Promise<Farm> {
  return apiClient.post("/farms", data).then((res: any) => res.farm);
}
export function updateFarm(id: string, data: Partial<FarmInput>): Promise<Farm> {
  return apiClient.patch(`/farms/${id}`, data).then((res: any) => res.farm);
}
export function fetchCompanies(signal?: AbortSignal): Promise<Company[]> {
  return apiClient.get("/companies", { signal }).then((res: any) => res.companies);
}
export function fetchCompany(id: string): Promise<Company> {
  return apiClient.get(`/companies/${id}`).then((res: any) => res.company);
}
export function createCompany(data: CompanyInput): Promise<Company> {
  return apiClient.post("/companies", data).then((res: any) => res.company);
}
export function updateCompany(id: string, data: Partial<CompanyInput>): Promise<Company> {
  return apiClient.patch(`/companies/${id}`, data).then((res: any) => res.company);
}

// -- Sheds --
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

// -- Workers --
export type WorkerListResult = WorkerListResponse;
export function fetchWorkers(query: WorkerListQuery, signal?: AbortSignal): Promise<WorkerListResult> {
  return apiClient.get("/workers", { query, signal });
}
export function fetchWorker(id: string): Promise<Worker> {
  return apiClient.get(`/workers/${id}`).then((res: any) => res.worker);
}
export function setWorkerActive(id: string, active: boolean): Promise<Worker> {
  return apiClient.patch(`/workers/${id}`, { status: active ? "ACTIVE" : "INACTIVE" }).then((res: any) => res.worker);
}
export function createWorker(data: WorkerInput, photo?: File | Blob | null): Promise<Worker> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("photo", photo, "worker.jpg");
    return fetch(`${API_BASE_URL}/workers`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(res.status, payload.message || "Failed to create worker", payload.errors, payload.formErrors);
      }
      return payload.worker;
    });
  }
  return apiClient.post("/workers", data).then((res: any) => res.worker);
}
export function updateWorker(id: string, data: Partial<WorkerInput>, photo?: File | Blob | null): Promise<Worker> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("photo", photo, "worker.jpg");
    return fetch(`${API_BASE_URL}/workers/${id}`, {
      method: "PATCH",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(res.status, payload.message || "Failed to update worker", payload.errors, payload.formErrors);
      }
      return payload.worker;
    });
  }
  return apiClient.patch(`/workers/${id}`, data).then((res: any) => res.worker);
}

// -- Attendance --
export function fetchAttendance(query: AttendanceListQuery, signal?: AbortSignal): Promise<AttendanceListResponse> {
  return apiClient.get("/attendance", { query, signal });
}
export function fetchAttendanceRecord(id: string): Promise<Attendance> {
  return apiClient.get(`/attendance/${id}`).then((res: any) => res.attendance);
}
export function createAttendance(data: AttendanceInput): Promise<Attendance> {
  return apiClient.post("/attendance", data).then((res: any) => res.attendance);
}
export function bulkCreateAttendance(data: BulkAttendanceInput): Promise<BulkAttendanceResponse> {
  return apiClient.post("/attendance/bulk", data);
}
export function correctAttendance(id: string, data: AttendanceCorrection): Promise<Attendance> {
  return apiClient.patch(`/attendance/${id}`, data).then((res: any) => res.attendance);
}
export function approveAttendance(id: string): Promise<Attendance> {
  return apiClient.post(`/attendance/${id}/approve`).then((res: any) => res.attendance);
}
export function fetchMarkedPersonIds(query: MarkedPersonIdsQuery, signal?: AbortSignal): Promise<MarkedPersonIdsResponse> {
  return apiClient.get("/attendance/marked-ids", { query, signal });
}
export function exportAttendanceUrl(query: ExportAttendanceQuery): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) searchParams.append(key, String(value));
  }
  return `${API_BASE_URL}/attendance/export?${searchParams.toString()}`;
}

// -- Audit Logs --
export interface AuditLogListQuery {
  page?: number;
  limit?: number;
  entity?: string;
  action?: "CREATE" | "UPDATE" | "DELETE" | "";
  search?: string;
  from?: string;
  to?: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  pagination: Pagination;
}

export function fetchAuditLogs(query: AuditLogListQuery, signal?: AbortSignal): Promise<AuditLogListResponse> {
  return apiClient.get("/audit-logs", { query, signal });
}

export function exportAuditLogsUrl(query: Omit<AuditLogListQuery, "page" | "limit">): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) searchParams.append(key, String(value));
  }
  return `${API_BASE_URL}/audit-logs/export?${searchParams.toString()}`;
}

// -- Excel Imports --
export interface ExcelImportSummary {
  totalCount: number;
  addedCount: number;
  failedCount: number;
  failedExcelBase64?: string;
  filename?: string;
}

export function importEmployeesExcel(file: File): Promise<{ success: boolean; message: string; summary: ExcelImportSummary }> {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${API_BASE_URL}/employees/import-excel`, {
    method: "POST",
    credentials: "include",
    body: formData,
  }).then(async (res) => {
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(res.status, payload.message || "Failed to import employees", payload.errors, payload.formErrors);
    }
    return payload;
  });
}

export function downloadEmployeeTemplateUrl(): string {
  return `${API_BASE_URL}/employees/import-template`;
}

export function importWorkersExcel(file: File): Promise<{ success: boolean; message: string; summary: ExcelImportSummary }> {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${API_BASE_URL}/workers/import-excel`, {
    method: "POST",
    credentials: "include",
    body: formData,
  }).then(async (res) => {
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(res.status, payload.message || "Failed to import workers", payload.errors, payload.formErrors);
    }
    return payload;
  });
}

export function downloadWorkerTemplateUrl(): string {
  return `${API_BASE_URL}/workers/import-template`;
}

