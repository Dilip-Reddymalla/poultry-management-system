import { apiClient, API_BASE_URL } from "./client.js";
import { enqueueAttendance } from "../lib/offline-store.js";
import type {
  Attendance,
  AttendanceStatus,
  Shift,
  Pagination,
  EnterpriseAttendanceReportResponse,
} from "./types.js";

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
  locationSource?:
    | "GPS_EXACT"
    | "NETWORK_APPROX"
    | "CACHED_GPS"
    | "IP_FALLBACK"
    | "FARM_DEFAULT"
    | "GEOFENCE_EXCEEDED";
  pendingApproval?: boolean;
  approvalStatus?: "ALL" | "PENDING" | "APPROVED";
  pendingLocationApproval?: boolean;
}

export interface AttendanceListResponse {
  attendance: Attendance[];
  pagination: Pagination;
}

export interface AttendanceInput {
  date: string;
  employeeId?: string | undefined;
  workerId?: string | undefined;
  shedId?: string | undefined;
  shift: Shift;
  status: AttendanceStatus;
  latitude: number;
  longitude: number;
  locationSource?:
    | "GPS_EXACT"
    | "NETWORK_APPROX"
    | "CACHED_GPS"
    | "IP_FALLBACK"
    | "FARM_DEFAULT"
    | undefined;
  accuracy?: number | null | undefined;
  ipAddress?: string | null | undefined;
  notes?: string | undefined;
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

export interface CurrentLocationResponse {
  latitude: number;
  longitude: number;
  accuracy: number;
  city: string;
  region: string;
  country: string;
  isp?: string;
  ip: string;
  isLoopback: boolean;
}

export interface UnmarkedSummaryQuery {
  date: string;
  shift: Shift;
  farmId: string;
  shedId?: string;
}

export interface UnmarkedSummaryResponse {
  success: boolean;
  unmarkedEmployees: { id: string; name: string; employeeId: string }[];
  unmarkedWorkers: { id: string; name: string; workerId: string }[];
  totalUnmarked: number;
}

export interface MarkUnmarkedAbsentInput {
  date: string;
  shift: Shift;
  farmId: string;
  shedId?: string;
  target?: "ALL" | "EMPLOYEES" | "WORKERS";
  latitude: number;
  longitude: number;
  notes?: string;
}

export interface MarkUnmarkedAbsentResponse {
  success: boolean;
  markedCount: number;
  employeeCount: number;
  workerCount: number;
  message: string;
}

export function fetchAttendance(
  query: AttendanceListQuery,
  signal?: AbortSignal,
): Promise<AttendanceListResponse> {
  return apiClient.get("/attendance", { query, signal });
}

export function fetchAttendanceRecord(id: string): Promise<Attendance> {
  return apiClient.get(`/attendance/${id}`).then((res: any) => res.attendance);
}

export function createAttendance(data: AttendanceInput): Promise<Attendance> {
  return apiClient.post("/attendance", data).then((res: any) => res.attendance);
}

export function bulkCreateAttendance(
  data: BulkAttendanceInput,
): Promise<BulkAttendanceResponse> {
  return apiClient.post("/attendance/bulk", data);
}

export function correctAttendance(id: string, data: AttendanceCorrection): Promise<Attendance> {
  return apiClient.patch(`/attendance/${id}`, data).then((res: any) => res.attendance);
}

export function approveAttendance(id: string): Promise<Attendance> {
  return apiClient.post(`/attendance/${id}/approve`).then((res: any) => res.attendance);
}

export function bulkApproveAttendance(ids: string[]): Promise<{ approvedCount: number }> {
  return apiClient.post("/attendance/bulk-approve", { ids });
}

export function fetchMarkedPersonIds(
  query: MarkedPersonIdsQuery,
  signal?: AbortSignal,
): Promise<MarkedPersonIdsResponse> {
  return apiClient.get("/attendance/marked-ids", { query, signal });
}

export function fetchEmployeeAttendanceRange(
  employeeId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AttendanceListResponse> {
  return apiClient.get("/attendance", {
    query: { employeeId, from, to, limit: 1000 },
    signal,
  });
}

export function fetchUnmarkedSummary(
  query: UnmarkedSummaryQuery,
  signal?: AbortSignal,
): Promise<UnmarkedSummaryResponse> {
  return apiClient.get("/attendance/unmarked-summary", { query, signal });
}

export function markUnmarkedAbsent(
  data: MarkUnmarkedAbsentInput,
): Promise<MarkUnmarkedAbsentResponse> {
  return apiClient.post("/attendance/mark-unmarked-absent", data);
}

export function fetchCurrentLocation(): Promise<CurrentLocationResponse> {
  return apiClient.get("/attendance/current-location").then((res: any) => res.location);
}

export function exportAttendanceUrl(query: ExportAttendanceQuery): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) searchParams.append(key, String(value));
  }
  return `${API_BASE_URL}/attendance/export?${searchParams.toString()}`;
}

export function fetchAttendanceReport(
  query: {
    date?: string;
    from?: string;
    to?: string;
    companyId?: string;
    farmId?: string;
    shift?: Shift;
  },
  signal?: AbortSignal,
): Promise<EnterpriseAttendanceReportResponse> {
  const params = new URLSearchParams();
  if (query.date) params.set("date", query.date);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.companyId) params.set("companyId", query.companyId);
  if (query.farmId) params.set("farmId", query.farmId);
  if (query.shift) params.set("shift", query.shift);
  const qs = params.toString();
  return apiClient
    .get(`/attendance/reports/summary${qs ? `?${qs}` : ""}`, { signal })
    .then((res: any) => res.data);
}

/**
 * Offline-aware attendance save. When offline the payload is queued locally and
 * returns immediately (queued:true); replayed by the offline sync engine on
 * reconnect. When online it behaves exactly like `createAttendance`.
 */
export type AttendanceSaveResult =
  | { queued: true; localId: string }
  | { queued: false; attendance: Attendance };

export async function createAttendanceWithOffline(
  data: AttendanceInput,
): Promise<AttendanceSaveResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const localId = await enqueueAttendance(
      data as unknown as Record<string, unknown>,
      "single",
    );
    return { queued: true, localId };
  }
  const attendance = await createAttendance(data);
  return { queued: false, attendance };
}

/**
 * Offline-aware bulk attendance save. When offline the whole bulk payload is
 * queued as one unit and replayed when connectivity returns — keeping server
 * load low because a batch stays a single request rather than N individual ones.
 */
export type BulkSaveResult =
  | { queued: true; localId: string }
  | { queued: false; response: BulkAttendanceResponse };

export async function bulkCreateAttendanceWithOffline(
  data: BulkAttendanceInput,
): Promise<BulkSaveResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const localId = await enqueueAttendance(
      data as unknown as Record<string, unknown>,
      "bulk",
    );
    return { queued: true, localId };
  }
  const response = await bulkCreateAttendance(data);
  return { queued: false, response };
}

/**
 * Submit an entire offline queue to the server's sync endpoint. The endpoint
 * replays items through the bulk attendance services and returns a per-item
 * result so this client can drop exactly what succeeded.
 */
export interface SyncItemInput {
  itemId: string;
  kind: "single" | "face";
  data: Record<string, unknown>;
}

export interface SyncItemResult {
  itemId: string;
  status: "fulfilled" | "rejected";
  reason?: string;
}

export function syncAttendanceBatch(
  items: SyncItemInput[],
): Promise<{ success: boolean; results: SyncItemResult[] }> {
  return apiClient.post("/sync/attendance", { items });
}
