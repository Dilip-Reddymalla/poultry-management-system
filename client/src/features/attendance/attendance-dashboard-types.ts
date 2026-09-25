import type { Shift } from "../../api/types.js";

export interface ShiftSummaryData {
  shift: Shift;
  label: string;
  total: number;
  present: number;
  halfDay: number;
  absent: number;
  leave: number;
}

export interface ShedSummaryItem {
  shedId: string;
  shedNumber: string;
  capacity?: number | undefined;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  total: number;
}

export interface ShiftShedCell {
  present: number;
  halfDay: number;
  absent: number;
  leave: number;
  total: number;
}

export interface ShiftShedRow {
  shedId: string;
  shedNumber: string;
  capacity?: number | undefined;
  byShift: Record<Shift, ShiftShedCell>;
  total: ShiftShedCell;
}

export interface AttendanceMetrics {
  presentEmployees: number;
  presentWorkers: number;
  totalPresent: number;
  halfDayCount: number;
  absentCount: number;
  leaveCount: number;
  faceAiCount: number;
  avgConfidence: number | null;
  pendingApprovalCount: number;
  attendanceRate: number;
  totalMarked: number;
}

export interface SnapshotPreviewData {
  url: string;
  name: string;
  score?: number | null | undefined;
  title?: string | undefined;
}

export const SHIFT_CONFIG: Record<Shift, { label: string; icon: string; timeRange: string; color: string }> = {
  MORNING_SHIFT: { label: "Morning", icon: "🌅", timeRange: "09:00 – 13:00", color: "var(--moss, #2e7d32)" },
  AFTERNOON_SHIFT: { label: "Afternoon", icon: "☀️", timeRange: "14:00 – 18:00", color: "var(--clay, #c2410c)" },
  NIGHT_SHIFT: { label: "Night", icon: "🌙", timeRange: "19:00 – 04:00", color: "#4f46e5" },
  OVERTIME: { label: "Overtime", icon: "⚡", timeRange: "Flexible / Extra", color: "#0891b2" },
};
