import { apiClient } from "./client.js";

export interface SystemErrorItem {
  id: string;
  requestId: string | null;
  statusCode: number;
  errorName: string;
  errorMessage: string;
  stackTrace: string | null;
  method: string;
  path: string;
  queryParams: Record<string, unknown> | null;
  requestBody: Record<string, unknown> | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  companyName: string | null;
  farmName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface ListSystemErrorsResponse {
  success: boolean;
  logs: SystemErrorItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListSystemErrorsParams {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  errorName?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export async function fetchSystemErrors(
  params: ListSystemErrorsParams = {},
  signal?: AbortSignal,
): Promise<ListSystemErrorsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.errorName) query.set("errorName", params.errorName);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);

  const qs = query.toString();
  const url = qs ? `/system-errors?${qs}` : "/system-errors";
  return apiClient.get<ListSystemErrorsResponse>(url, { signal });
}

export async function fetchSystemErrorById(
  id: string,
  signal?: AbortSignal,
): Promise<{ success: boolean; data: SystemErrorItem }> {
  return apiClient.get<{ success: boolean; data: SystemErrorItem }>(`/system-errors/${id}`, { signal });
}

export async function resolveSystemError(id: string): Promise<{ success: boolean; data: SystemErrorItem }> {
  return apiClient.patch<{ success: boolean; data: SystemErrorItem }>(`/system-errors/${id}/resolve`, {});
}
