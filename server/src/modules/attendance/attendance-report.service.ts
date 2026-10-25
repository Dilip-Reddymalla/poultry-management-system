import { Prisma, type Shift } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import type { AuthScope } from "../auth/scope.js";
import type { AttendanceReportQueryInput } from "./attendance.schema.js";

export interface FarmAttendanceReportSummary {
  farmId: string;
  farmCode: string;
  farmName: string;
  companyId: string;
  companyName: string;
  totalWorkforce: number;
  totalEmployees: number;
  totalWorkers: number;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  leaveCount: number;
  unmarkedCount: number;
  attendanceRate: number;
  shiftsBreakdown: Record<Shift, { present: number; absent: number; halfDay: number; leave: number }>;
  flaggedIpFallbacks: number;
  pendingApprovals: number;
}

export interface DailyTrendItem {
  date: string;
  dayLabel: string;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  attendanceRate: number;
}

export interface FarmComparisonItem {
  farmId: string;
  farmCode: string;
  farmName: string;
  companyName: string;
  attendanceRate: number;
  /** How many percentage-points this farm deviates from the avg */
  deltaFromAvg: number;
  /** 1 = best farm */
  rank: number;
  totalWorkforce: number;
  presentCount: number;
  absentCount: number;
  isBest: boolean;
  isWorst: boolean;
}

export interface EnterpriseAttendanceReportResponse {
  dateRange: {
    from: string;
    to: string;
    isSingleDay: boolean;
  };
  isSystemAdmin: boolean;
  scopeLevel: string;
  overview: {
    totalCompanies: number;
    totalFarms: number;
    totalWorkforce: number;
    overallAttendanceRate: number;
    totalPresent: number;
    totalAbsent: number;
    totalHalfDay: number;
    totalLeave: number;
    totalUnmarked: number;
    totalPendingApprovals: number;
    totalFlaggedIpFallbacks: number;
  };
  farms: FarmAttendanceReportSummary[];
  trends: DailyTrendItem[];
  /** Cross-farm comparison; only present when ≥ 2 farms */
  farmComparison: FarmComparisonItem[] | null;
}

export async function getEnterpriseAttendanceReport(
  scope: AuthScope,
  query: AttendanceReportQueryInput,
): Promise<EnterpriseAttendanceReportResponse> {
  // Validate caller authority: System Admin (GLOBAL) or Company-level user (COMPANY)
  if (!scope.isSystemAdmin && scope.level !== "COMPANY" && scope.level !== "GLOBAL") {
    throw new AppError("Access denied. Attendance report is reserved for Company and System Administrators.", 403);
  }

  // Determine target company filter
  const isGlobalUser = scope.isSystemAdmin || scope.level === "GLOBAL";
  let targetCompanyId: string | undefined = undefined;

  if (isGlobalUser) {
    // Global admin can view all companies or filter to a specific company
    if (query.companyId) {
      targetCompanyId = query.companyId;
    }
  } else {
    // Company user is strictly limited to their own company
    if (!scope.companyId) {
      throw new AppError("User is not associated with any company", 403);
    }
    targetCompanyId = scope.companyId;
  }

  // Date range determination (defaults to today UTC)
  const today = new Date().toISOString().slice(0, 10);
  let dateFilter: Date | { gte: Date; lte: Date };
  let fromStr: string;
  let toStr: string;
  let isSingleDay = false;

  if (query.date !== undefined) {
    dateFilter = query.date;
    fromStr = query.date.toISOString().slice(0, 10);
    toStr = fromStr;
    isSingleDay = true;
  } else if (query.from !== undefined || query.to !== undefined) {
    const fromDate = query.from ?? new Date(`${today}T00:00:00.000Z`);
    const toDate = query.to ?? new Date(`${today}T00:00:00.000Z`);
    dateFilter = { gte: fromDate, lte: toDate };
    fromStr = fromDate.toISOString().slice(0, 10);
    toStr = toDate.toISOString().slice(0, 10);
    isSingleDay = fromStr === toStr;
  } else {
    const defaultDate = new Date(`${today}T00:00:00.000Z`);
    dateFilter = defaultDate;
    fromStr = today;
    toStr = today;
    isSingleDay = true;
  }

  // 1. Fetch relevant farms with active employee and worker headcounts
  const farmWhere: Prisma.FarmWhereInput = {
    status: "ACTIVE",
    ...(targetCompanyId ? { companyId: targetCompanyId } : {}),
    ...(query.farmId ? { id: query.farmId } : {}),
  };

  const farms = await prisma.farm.findMany({
    where: farmWhere,
    select: {
      id: true,
      code: true,
      name: true,
      companyId: true,
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          employees: { where: { status: "ACTIVE" } },
          workers: { where: { status: "ACTIVE" } },
        },
      },
    },
    orderBy: [
      { company: { name: "asc" } },
      { code: "asc" },
    ],
  });

  const farmIds = farms.map((f) => f.id);
  if (farmIds.length === 0) {
    return {
      dateRange: { from: fromStr, to: toStr, isSingleDay },
      isSystemAdmin: scope.isSystemAdmin,
      scopeLevel: scope.level,
      overview: {
        totalCompanies: 0,
        totalFarms: 0,
        totalWorkforce: 0,
        overallAttendanceRate: 0,
        totalPresent: 0,
        totalAbsent: 0,
        totalHalfDay: 0,
        totalLeave: 0,
        totalUnmarked: 0,
        totalPendingApprovals: 0,
        totalFlaggedIpFallbacks: 0,
      },
      farms: [],
      trends: [],
      farmComparison: null,
    };
  }

  // 2. Aggregate attendance counts grouped by farmId, shift, status
  const attendanceWhere: Prisma.AttendanceWhereInput = {
    farmId: { in: farmIds },
    date: dateFilter,
    ...(query.shift ? { shift: query.shift } : {}),
  };

  // Determine 7-day trend window ending on the target date
  const targetEndDay = isSingleDay && query.date
    ? query.date
    : new Date(`${toStr}T00:00:00.000Z`);
  const trendStartDay = new Date(targetEndDay);
  trendStartDay.setDate(trendStartDay.getDate() - 6);

  const [groupedStats, pendingStats, fallbackStats, trendStats] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["farmId", "date", "shift", "status"],
      where: attendanceWhere,
      _count: { id: true },
    }),
    prisma.attendance.groupBy({
      by: ["farmId"],
      where: {
        ...attendanceWhere,
        approvedAt: null,
      },
      _count: { id: true },
    }),
    prisma.attendance.groupBy({
      by: ["farmId"],
      where: {
        ...attendanceWhere,
        locationSource: "IP_FALLBACK",
      },
      _count: { id: true },
    }),
    prisma.attendance.groupBy({
      by: ["date", "farmId", "shift", "status"],
      where: {
        farmId: { in: farmIds },
        date: { gte: trendStartDay, lte: targetEndDay },
        ...(query.shift ? { shift: query.shift } : {}),
      },
      _count: { id: true },
    }),
  ]);

  const pendingMap = new Map<string, number>();
  for (const item of pendingStats) {
    pendingMap.set(item.farmId, item._count.id);
  }

  const fallbackMap = new Map<string, number>();
  for (const item of fallbackStats) {
    fallbackMap.set(item.farmId, item._count.id);
  }

  // Organize grouped data by farm and date
  const allShifts: Shift[] = ["MORNING_SHIFT", "AFTERNOON_SHIFT", "NIGHT_SHIFT", "OVERTIME"];

  const farmShiftsBreakdown = new Map<
    string,
    Record<Shift, { present: number; absent: number; halfDay: number; leave: number }>
  >();

  const farmDateShiftsMap = new Map<
    string,
    Map<string, Record<Shift, { present: number; absent: number; halfDay: number; leave: number }>>
  >();

  for (const fId of farmIds) {
    const shiftRecords = allShifts.reduce((acc, s) => {
      acc[s] = { present: 0, absent: 0, halfDay: 0, leave: 0 };
      return acc;
    }, {} as Record<Shift, { present: number; absent: number; halfDay: number; leave: number }>);

    farmShiftsBreakdown.set(fId, shiftRecords);
    farmDateShiftsMap.set(fId, new Map());
  }

  for (const row of groupedStats) {
    const shiftsRecord = farmShiftsBreakdown.get(row.farmId);
    if (!shiftsRecord) continue;

    const farmDates = farmDateShiftsMap.get(row.farmId)!;
    const dateStr = row.date.toISOString().slice(0, 10);
    let dayShifts = farmDates.get(dateStr);
    if (!dayShifts) {
      dayShifts = allShifts.reduce((acc, s) => {
        acc[s] = { present: 0, absent: 0, halfDay: 0, leave: 0 };
        return acc;
      }, {} as Record<Shift, { present: number; absent: number; halfDay: number; leave: number }>);
      farmDates.set(dateStr, dayShifts);
    }

    const count = row._count.id;
    if (row.status === "PRESENT") {
      shiftsRecord[row.shift].present += count;
      dayShifts[row.shift].present += count;
    } else if (row.status === "ABSENT") {
      shiftsRecord[row.shift].absent += count;
      dayShifts[row.shift].absent += count;
    } else if (row.status === "HALF_DAY") {
      shiftsRecord[row.shift].halfDay += count;
      dayShifts[row.shift].halfDay += count;
    } else if (row.status === "LEAVE") {
      shiftsRecord[row.shift].leave += count;
      dayShifts[row.shift].leave += count;
    }
  }

  // 3. Compile farm summaries and grand totals
  const farmSummaries: FarmAttendanceReportSummary[] = [];
  let grandTotalWorkforce = 0;
  let grandTotalPresent = 0;
  let grandTotalAbsent = 0;
  let grandTotalHalfDay = 0;
  let grandTotalLeave = 0;
  let grandTotalUnmarked = 0;
  let grandTotalPending = 0;
  let grandTotalFallbacks = 0;
  const uniqueCompanies = new Set<string>();

  for (const farm of farms) {
    uniqueCompanies.add(farm.companyId);
    const shiftsData = farmShiftsBreakdown.get(farm.id)!;
    const farmDates = farmDateShiftsMap.get(farm.id)!;
    const totalEmployees = farm._count.employees;
    const totalWorkers = farm._count.workers;
    const totalWorkforce = totalEmployees + totalWorkers;

    let farmPresent = 0;
    let farmAbsent = 0;
    let farmHalfDay = 0;
    let farmLeave = 0;

    for (const [, dayShifts] of farmDates.entries()) {
      if (query.shift) {
        const sData = dayShifts[query.shift];
        if (sData) {
          farmPresent += sData.present;
          farmAbsent += sData.absent;
          farmHalfDay += sData.halfDay;
          farmLeave += sData.leave;
        }
      } else {
        // "All Shifts": absent count and present count take the max across all shifts of the day
        const shiftEntries = Object.values(dayShifts);
        const maxDayPresent = Math.max(0, ...shiftEntries.map((s) => s.present));
        const maxDayAbsent = Math.max(0, ...shiftEntries.map((s) => s.absent));
        const maxDayHalfDay = Math.max(0, ...shiftEntries.map((s) => s.halfDay));
        const maxDayLeave = Math.max(0, ...shiftEntries.map((s) => s.leave));

        farmPresent += maxDayPresent;
        farmAbsent += maxDayAbsent;
        farmHalfDay += maxDayHalfDay;
        farmLeave += maxDayLeave;
      }
    }

    // For single day, unmarked is workforce minus recorded (floor at 0)
    const recordedCount = farmPresent + farmAbsent + farmHalfDay + farmLeave;
    const unmarkedCount = isSingleDay ? Math.max(0, totalWorkforce - recordedCount) : 0;

    // Effective attendance: Present + 0.5 * HalfDay
    const effectivePresent = farmPresent + farmHalfDay * 0.5;
    const rateDenominator = isSingleDay ? totalWorkforce : (recordedCount || 1);
    const attendanceRate = rateDenominator > 0
      ? Math.min(100, Math.round((effectivePresent / rateDenominator) * 1000) / 10)
      : 0;

    const pending = pendingMap.get(farm.id) ?? 0;
    const fallbacks = fallbackMap.get(farm.id) ?? 0;

    grandTotalWorkforce += totalWorkforce;
    grandTotalPresent += farmPresent;
    grandTotalAbsent += farmAbsent;
    grandTotalHalfDay += farmHalfDay;
    grandTotalLeave += farmLeave;
    grandTotalUnmarked += unmarkedCount;
    grandTotalPending += pending;
    grandTotalFallbacks += fallbacks;

    farmSummaries.push({
      farmId: farm.id,
      farmCode: farm.code,
      farmName: farm.name,
      companyId: farm.companyId,
      companyName: farm.company.name,
      totalWorkforce,
      totalEmployees,
      totalWorkers,
      presentCount: farmPresent,
      absentCount: farmAbsent,
      halfDayCount: farmHalfDay,
      leaveCount: farmLeave,
      unmarkedCount,
      attendanceRate,
      shiftsBreakdown: shiftsData,
      flaggedIpFallbacks: fallbacks,
      pendingApprovals: pending,
    });
  }

  const grandEffectivePresent = grandTotalPresent + grandTotalHalfDay * 0.5;
  const grandDenominator = isSingleDay
    ? grandTotalWorkforce
    : (grandTotalPresent + grandTotalAbsent + grandTotalHalfDay + grandTotalLeave || 1);

  const overallAttendanceRate = grandDenominator > 0
    ? Math.min(100, Math.round((grandEffectivePresent / grandDenominator) * 1000) / 10)
    : 0;

  // Build 7-day chronological trends map
  const trendDateFarmMap = new Map<
    string,
    Map<string, Record<Shift, { present: number; absent: number; halfDay: number; leave: number }>>
  >();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(targetEndDay);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    trendDateFarmMap.set(dateStr, new Map());
  }

  for (const row of trendStats) {
    const dStr = row.date.toISOString().slice(0, 10);
    const farmMapForDate = trendDateFarmMap.get(dStr);
    if (!farmMapForDate) continue;

    let farmShiftRec = farmMapForDate.get(row.farmId);
    if (!farmShiftRec) {
      farmShiftRec = allShifts.reduce((acc, s) => {
        acc[s] = { present: 0, absent: 0, halfDay: 0, leave: 0 };
        return acc;
      }, {} as Record<Shift, { present: number; absent: number; halfDay: number; leave: number }>);
      farmMapForDate.set(row.farmId, farmShiftRec);
    }

    const count = row._count.id;
    if (row.status === "PRESENT") farmShiftRec[row.shift].present += count;
    else if (row.status === "ABSENT") farmShiftRec[row.shift].absent += count;
    else if (row.status === "HALF_DAY") farmShiftRec[row.shift].halfDay += count;
    else if (row.status === "LEAVE") farmShiftRec[row.shift].leave += count;
  }

  const trends: DailyTrendItem[] = Array.from(trendDateFarmMap.entries()).map(([dateStr, farmMapForDate]) => {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

    let dayPresent = 0;
    let dayAbsent = 0;
    let dayHalfDay = 0;
    let dayLeave = 0;

    for (const [, farmShifts] of farmMapForDate.entries()) {
      if (query.shift) {
        const sData = farmShifts[query.shift];
        if (sData) {
          dayPresent += sData.present;
          dayAbsent += sData.absent;
          dayHalfDay += sData.halfDay;
          dayLeave += sData.leave;
        }
      } else {
        const entries = Object.values(farmShifts);
        dayPresent += Math.max(0, ...entries.map((s) => s.present));
        dayAbsent += Math.max(0, ...entries.map((s) => s.absent));
        dayHalfDay += Math.max(0, ...entries.map((s) => s.halfDay));
        dayLeave += Math.max(0, ...entries.map((s) => s.leave));
      }
    }

    const effective = dayPresent + dayHalfDay * 0.5;
    const recorded = dayPresent + dayAbsent + dayHalfDay + dayLeave;
    const rateDenominator = grandTotalWorkforce > 0 ? grandTotalWorkforce : (recorded || 1);
    const attendanceRate = Math.min(100, Math.round((effective / rateDenominator) * 1000) / 10);

    return {
      date: dateStr,
      dayLabel,
      present: dayPresent,
      absent: dayAbsent,
      halfDay: dayHalfDay,
      leave: dayLeave,
      attendanceRate,
    };
  });

  // Build cross-farm comparison (only when multiple farms)
  let farmComparison: FarmComparisonItem[] | null = null;
  if (farmSummaries.length >= 2) {
    // Sort descending by attendance rate, then by workforce size as tiebreaker
    const sorted = [...farmSummaries].sort(
      (a, b) => b.attendanceRate - a.attendanceRate || b.totalWorkforce - a.totalWorkforce,
    );
    const avgRate = overallAttendanceRate;

    farmComparison = sorted.map((f, idx) => ({
      farmId: f.farmId,
      farmCode: f.farmCode,
      farmName: f.farmName,
      companyName: f.companyName,
      attendanceRate: f.attendanceRate,
      deltaFromAvg: Math.round((f.attendanceRate - avgRate) * 10) / 10,
      rank: idx + 1,
      totalWorkforce: f.totalWorkforce,
      presentCount: f.presentCount,
      absentCount: f.absentCount,
      isBest: idx === 0,
      isWorst: idx === sorted.length - 1,
    }));
  }

  return {
    dateRange: {
      from: fromStr,
      to: toStr,
      isSingleDay,
    },
    isSystemAdmin: scope.isSystemAdmin,
    scopeLevel: scope.level,
    overview: {
      totalCompanies: uniqueCompanies.size,
      totalFarms: farms.length,
      totalWorkforce: grandTotalWorkforce,
      overallAttendanceRate,
      totalPresent: grandTotalPresent,
      totalAbsent: grandTotalAbsent,
      totalHalfDay: grandTotalHalfDay,
      totalLeave: grandTotalLeave,
      totalUnmarked: grandTotalUnmarked,
      totalPendingApprovals: grandTotalPending,
      totalFlaggedIpFallbacks: grandTotalFallbacks,
    },
    farms: farmSummaries,
    trends,
    farmComparison,
  };
}
