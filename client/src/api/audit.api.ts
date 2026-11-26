import { apiClient, API_BASE_URL } from "./client.js";
import type { AuditLog, Pagination } from "./types.js";

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

export function fetchAuditLogs(
  query: AuditLogListQuery,
  signal?: AbortSignal,
): Promise<AuditLogListResponse> {
  return apiClient.get("/audit-logs", { query, signal });
}

export function exportAuditLogsUrl(
  query: Omit<AuditLogListQuery, "page" | "limit">,
  format: "xlsx" | "csv" = "xlsx",
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) searchParams.append(key, String(value));
  }
  if (format === "csv") searchParams.set("format", "csv");
  return `${API_BASE_URL}/audit-logs/export?${searchParams.toString()}`;
}
