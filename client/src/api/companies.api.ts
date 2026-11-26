import { apiClient, API_BASE_URL, ApiError } from "./client.js";
import type {
  Company,
  Pagination,
  Shift,
  ShiftTimingItem,
  CompanyRolesConfigResponse,
  CompanyRoleHierarchyInputItem,
  CreateCompanyCustomRoleInput,
  UpdateCompanyCustomRoleInput,
} from "./types.js";

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
  logoUrl?: string | null;
  website?: string | null;
  gstin?: string;
  pan?: string;
  address?: string;
}

export function fetchCompanies(signal?: AbortSignal): Promise<Company[]> {
  return apiClient.get("/companies", { signal }).then((res: any) => res.companies);
}

export function fetchCompany(id: string): Promise<Company> {
  return apiClient.get(`/companies/${id}`).then((res: any) => res.company);
}

export function createCompany(
  data: CompanyInput,
  photo?: File | Blob | null,
): Promise<Company> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    });
    formData.append("photo", photo, "company-logo.jpg");
    return fetch(`${API_BASE_URL}/companies`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          res.status,
          payload.message || "Failed to create company",
          payload.errors,
          payload.formErrors,
        );
      }
      return payload.company;
    });
  }
  return apiClient.post("/companies", data).then((res: any) => res.company);
}

export function updateCompany(
  id: string,
  data: Partial<CompanyInput>,
  photo?: File | Blob | null,
): Promise<Company> {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    });
    formData.append("photo", photo, "company-logo.jpg");
    return fetch(`${API_BASE_URL}/companies/${id}`, {
      method: "PATCH",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          res.status,
          payload.message || "Failed to update company",
          payload.errors,
          payload.formErrors,
        );
      }
      return payload.company;
    });
  }
  return apiClient.patch(`/companies/${id}`, data).then((res: any) => res.company);
}

// -- Company Shift Timings --
export function fetchCompanyShiftTimings(companyId: string): Promise<ShiftTimingItem[]> {
  return apiClient.get(`/companies/${companyId}/shift-timings`).then((res: any) => res.shifts);
}

export function updateCompanyShiftTiming(
  companyId: string,
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
    .put(`/companies/${companyId}/shift-timings/${shift}`, input)
    .then((res: any) => res.timing);
}

// -- Company Roles Configuration --
export function fetchCompanyRolesConfig(companyId: string): Promise<CompanyRolesConfigResponse> {
  return apiClient.get(`/companies/${companyId}/roles-config`).then((res: any) => res);
}

export function toggleCompanyRole(
  companyId: string,
  roleId: string,
  isEnabled: boolean,
): Promise<any> {
  return apiClient.patch(`/companies/${companyId}/roles/${roleId}/toggle`, { isEnabled });
}

export function updateCompanyRole(
  companyId: string,
  roleId: string,
  input: { isEnabled?: boolean; customRank?: number | null },
): Promise<any> {
  return apiClient.patch(`/companies/${companyId}/roles/${roleId}`, input);
}

export function bulkToggleCompanyRoles(companyId: string, enabled: boolean): Promise<any> {
  return apiClient.patch(`/companies/${companyId}/roles/bulk`, { enabled });
}

export function updateCompanyRolesHierarchy(
  companyId: string,
  hierarchy: CompanyRoleHierarchyInputItem[],
): Promise<{ success: boolean; updatedCount: number }> {
  return apiClient.put(`/companies/${companyId}/roles/hierarchy`, { hierarchy });
}

export function createCompanyCustomRole(
  companyId: string,
  input: CreateCompanyCustomRoleInput,
): Promise<{ message: string; role: any }> {
  return apiClient.post(`/companies/${companyId}/roles/custom`, input);
}

export function updateCompanyCustomRole(
  companyId: string,
  roleId: string,
  input: UpdateCompanyCustomRoleInput,
): Promise<{ message: string; role: any }> {
  return apiClient.patch(`/companies/${companyId}/roles/custom/${roleId}`, input);
}

export function deleteCompanyCustomRole(
  companyId: string,
  roleId: string,
): Promise<{ success: boolean; id: string }> {
  return apiClient.delete(`/companies/${companyId}/roles/custom/${roleId}`);
}
