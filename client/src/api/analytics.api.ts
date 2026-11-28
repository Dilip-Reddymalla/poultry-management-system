import { apiClient } from "./client.js";

export interface AnalyticsData {
  workforce: {
    totalEmployees: number;
    activeEmployees: number;
    inactiveEmployees: number;
    totalWorkers: number;
    activeWorkers: number;
    inactiveWorkers: number;
    totalStaff: number;
    activeStaff: number;
  };
  infrastructure: {
    totalFarms: number;
    activeFarms: number;
    inactiveFarms: number;
    totalSheds: number;
    totalCapacity: number;
    shedsByStatus: Array<{ status: string; count: number; capacity: number }>;
  };
  attendance: {
    today: { date: string; present: number; absent: number; halfDay: number; leave: number; total: number; presentRate: number };
    month: { monthName: string; present: number; absent: number; halfDay: number; leave: number; total: number; presentRate: number };
    modeBreakdown: { faceAi: number; manual: number; total: number; faceAiRate: number };
    dailyTrend: Array<{ date: string; present: number; absent: number; faceAi: number; total: number }>;
  };
  faceAiMetrics: {
    totalAiVerifications: number;
    avgLivenessScore: number;
    avgConfidenceScore: number;
    avgQualityScore: number;
  };
  topFarmsActivity: Array<{ farmCode: string; totalAttendances: number }>;
  comparisons?: {
    shifts: Array<{ shift: string; label: string; count: number; percentage: number }>;
    verificationChannels: { faceAiRate: number; manualRate: number; faceAiAvgTimeMs: number; manualAvgTimeMs: number };
    capacityUtilization: { activeCapacity: number; totalCapacity: number; readinessRate: number };
    attendanceBenchmark: { todayRate: number; monthRate: number; hasTodayData: boolean; complianceRate: number };
  };
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsData> {
  // Go through apiClient so the session cookie is always sent (required on the
  // cross-origin API path) and errors go through the standard ApiError envelope.
  const payload = await apiClient.get<{ data: AnalyticsData }>(
    "/analytics/summary",
  );
  return payload.data;
}
