import { prisma } from "../../config/database.js";

export interface AnalyticsSummary {
  workforce: {
    totalEmployees: number;
    activeEmployees: number;
    inactiveEmployees: number;
    totalWorkers: number;
    activeWorkers: number;
    inactiveWorkers: number;
    promotedWorkers: number;
    totalStaff: number;
    activeStaff: number;
  };
  infrastructure: {
    totalFarms: number;
    activeFarms: number;
    inactiveFarms: number;
    totalSheds: number;
    totalCapacity: number;
    shedsByStatus: Array<{
      status: string;
      count: number;
      capacity: number;
    }>;
  };
  attendance: {
    today: {
      date: string;
      present: number;
      absent: number;
      halfDay: number;
      leave: number;
      total: number;
      presentRate: number;
    };
    month: {
      monthName: string;
      present: number;
      absent: number;
      halfDay: number;
      leave: number;
      total: number;
      presentRate: number;
    };
    modeBreakdown: {
      faceAi: number;
      manual: number;
      total: number;
      faceAiRate: number;
    };
    dailyTrend: Array<{
      date: string;
      present: number;
      absent: number;
      faceAi: number;
      total: number;
    }>;
  };
  faceAiMetrics: {
    totalAiVerifications: number;
    avgLivenessScore: number;
    avgConfidenceScore: number;
    avgQualityScore: number;
  };
  topFarmsActivity: Array<{
    farmCode: string;
    totalAttendances: number;
  }>;
  comparisons: {
    shifts: Array<{
      shift: string;
      label: string;
      count: number;
      percentage: number;
    }>;
    verificationChannels: {
      faceAiRate: number;
      manualRate: number;
    };
    capacityUtilization: {
      activeCapacity: number;
      totalCapacity: number;
      readinessRate: number;
    };
    attendanceBenchmark: {
      todayRate: number;
      monthRate: number;
      hasTodayData: boolean;
      complianceRate: number;
    };
  };
}

export async function getPublicAnalyticsSummary(): Promise<AnalyticsSummary> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    farmStats,
    shedStats,
    employeeStats,
    workerStats,
    todayAttendance,
    monthAttendance,
    modeBreakdownStats,
    aiAggregate,
    recentFarmsAttendance,
    recentDailyAttendance,
    shiftStats,
  ] = await Promise.all([
    // Real infrastructure & attendance metrics (without leaking employee totals)
    // 1. Farms by status
    prisma.farm.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // 4. Sheds by status with capacity sum
    prisma.shed.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { capacity: true },
    }),

    // 2. Employees by status (real counts)
    prisma.employee.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // 3. Workers by status (real counts)
    prisma.worker.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // 5. Today's attendance
    prisma.attendance.groupBy({
      by: ["status"],
      where: {
        date: { gte: todayStart },
      },
      _count: { id: true },
    }),

    // 6. Current month's attendance
    prisma.attendance.groupBy({
      by: ["status"],
      where: {
        date: { gte: monthStart },
      },
      _count: { id: true },
    }),

    // 7. Verification mode breakdown (last 90 days for relevance)
    prisma.attendance.groupBy({
      by: ["verificationMode"],
      where: {
        createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
      },
      _count: { id: true },
    }),

    // 8. Face AI scores aggregate
    prisma.attendance.aggregate({
      where: {
        verificationMode: "FACE_AI",
      },
      _count: { id: true },
      _avg: {
        livenessScore: true,
        confidenceScore: true,
        qualityScore: true,
      },
    }),

    // 9. Top farms by attendance (last 30 days) - strictly farm codes only
    prisma.attendance.groupBy({
      by: ["farmId"],
      where: {
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      _count: { id: true },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 5,
    }),

    // 10. Daily trend for last 14 days
    prisma.attendance.findMany({
      where: {
        date: { gte: fourteenDaysAgo },
      },
      select: {
        date: true,
        status: true,
        verificationMode: true,
      },
    }),

    // 11. Operational shift breakdown (all-time / 90 days for statistical distribution)
    prisma.attendance.groupBy({
      by: ["shift"],
      _count: { id: true },
    }),
  ]);

  // Transform farms
  let activeFarms = 0;
  let inactiveFarms = 0;
  for (const item of farmStats) {
    if (item.status === "ACTIVE") activeFarms = item._count.id;
    else if (item.status === "INACTIVE") inactiveFarms = item._count.id;
  }
  const totalFarms = activeFarms + inactiveFarms;

  // Transform sheds
  let totalSheds = 0;
  let totalCapacity = 0;
  const shedsByStatus = shedStats.map((item) => {
    const count = item._count.id;
    const capacity = item._sum.capacity || 0;
    totalSheds += count;
    totalCapacity += capacity;
    return {
      status: item.status,
      count,
      capacity,
    };
  });

  // Transform workforce (real counts from the employees/workers tables)
  let totalEmployees = 0;
  let activeEmployees = 0;
  let inactiveEmployees = 0;
  for (const item of employeeStats) {
    totalEmployees += item._count.id;
    if (item.status === "ACTIVE") activeEmployees = item._count.id;
    else if (item.status === "INACTIVE") inactiveEmployees = item._count.id;
  }

  let totalWorkers = 0;
  let activeWorkers = 0;
  let inactiveWorkers = 0;
  let promotedWorkers = 0;
  for (const item of workerStats) {
    totalWorkers += item._count.id;
    if (item.status === "ACTIVE") activeWorkers = item._count.id;
    else if (item.status === "INACTIVE") inactiveWorkers = item._count.id;
    else if (item.status === "PROMOTED") promotedWorkers = item._count.id;
  }

  const totalStaff = totalEmployees + totalWorkers;
  const activeStaff = activeEmployees + activeWorkers;

  // Transform Today's attendance
  let todayPresent = 0;
  let todayAbsent = 0;
  let todayHalfDay = 0;
  let todayLeave = 0;
  for (const item of todayAttendance) {
    if (item.status === "PRESENT") todayPresent = item._count.id;
    else if (item.status === "ABSENT") todayAbsent = item._count.id;
    else if (item.status === "HALF_DAY") todayHalfDay = item._count.id;
    else if (item.status === "LEAVE") todayLeave = item._count.id;
  }
  const todayTotal = todayPresent + todayAbsent + todayHalfDay + todayLeave;
  const todayRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

  // Transform Month's attendance
  let monthPresent = 0;
  let monthAbsent = 0;
  let monthHalfDay = 0;
  let monthLeave = 0;
  for (const item of monthAttendance) {
    if (item.status === "PRESENT") monthPresent = item._count.id;
    else if (item.status === "ABSENT") monthAbsent = item._count.id;
    else if (item.status === "HALF_DAY") monthHalfDay = item._count.id;
    else if (item.status === "LEAVE") monthLeave = item._count.id;
  }
  const monthTotal = monthPresent + monthAbsent + monthHalfDay + monthLeave;
  const monthRate = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : 0;

  // Transform Mode Breakdown
  let faceAiCount = 0;
  let manualCount = 0;
  for (const item of modeBreakdownStats) {
    if (item.verificationMode === "FACE_AI") {
      faceAiCount += item._count.id;
    } else {
      manualCount += item._count.id;
    }
  }
  const modeTotal = faceAiCount + manualCount;
  const faceAiRate = modeTotal > 0 ? Math.round((faceAiCount / modeTotal) * 100) : 0;

  // Top farms lookup (real attendance volume without exposing customer farm codes)
  const topFarmsActivity = recentFarmsAttendance.map((f, idx) => ({
    farmCode: `Farm ${idx + 1}`,
    totalAttendances: f._count.id,
  }));

  // Transform daily trend (aggregate by date formatted YYYY-MM-DD)
  const dailyMap = new Map<string, { present: number; absent: number; faceAi: number; total: number }>();
  for (const record of recentDailyAttendance) {
    const dayStr = record.date.toISOString().split("T")[0] ?? "";
    if (!dailyMap.has(dayStr)) {
      dailyMap.set(dayStr, { present: 0, absent: 0, faceAi: 0, total: 0 });
    }
    const entry = dailyMap.get(dayStr)!;
    entry.total += 1;
    if (record.status === "PRESENT") entry.present += 1;
    if (record.status === "ABSENT") entry.absent += 1;
    if (record.verificationMode === "FACE_AI") entry.faceAi += 1;
  }

  const sortedDates = Array.from(dailyMap.keys()).sort();
  const dailyTrend = sortedDates.map((d) => ({
    date: d,
    ...dailyMap.get(d)!,
  }));

  // Operational Shift distribution
  let totalShiftCount = 0;
  const shiftMap: Record<string, number> = {
    MORNING_SHIFT: 0,
    AFTERNOON_SHIFT: 0,
    NIGHT_SHIFT: 0,
  };
  if (Array.isArray(shiftStats)) {
    for (const item of shiftStats) {
      if (item.shift in shiftMap) {
        shiftMap[item.shift] = item._count.id;
        totalShiftCount += item._count.id;
      }
    }
  }

  const shiftLabels: Record<string, string> = {
    MORNING_SHIFT: "Morning Shift (06:00 - 14:00)",
    AFTERNOON_SHIFT: "Afternoon Shift (14:00 - 22:00)",
    NIGHT_SHIFT: "Night Shift (22:00 - 06:00)",
  };

  const shiftsComparison = Object.entries(shiftMap).map(([shiftKey, count]) => ({
    shift: shiftKey,
    label: shiftLabels[shiftKey] || shiftKey,
    count,
    percentage: totalShiftCount > 0
      ? Math.round((count / totalShiftCount) * 100)
      : 0,
  }));

  // Shed capacity operational readiness
  let activeCapacity = 0;
  for (const s of shedsByStatus) {
    if (s.status === "AVAILABLE" || s.status === "OCCUPIED") {
      activeCapacity += s.capacity;
    }
  }
  const readinessRate = totalCapacity > 0 ? Math.round((activeCapacity / totalCapacity) * 100) : 100;

  const comparisons = {
    shifts: shiftsComparison,
    verificationChannels: {
      faceAiRate,
      manualRate: modeTotal > 0 ? 100 - faceAiRate : 0,
    },
    capacityUtilization: {
      activeCapacity,
      totalCapacity,
      readinessRate,
    },
    attendanceBenchmark: {
      todayRate,
      monthRate,
      hasTodayData: todayTotal > 0,
      complianceRate: monthRate,
    },
  };

  return {
    workforce: {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      totalWorkers,
      activeWorkers,
      inactiveWorkers,
      promotedWorkers,
      totalStaff,
      activeStaff,
    },
    infrastructure: {
      totalFarms,
      activeFarms,
      inactiveFarms,
      totalSheds,
      totalCapacity,
      shedsByStatus,
    },
    attendance: {
      today: {
        date: todayStart.toISOString().split("T")[0] ?? "",
        present: todayPresent,
        absent: todayAbsent,
        halfDay: todayHalfDay,
        leave: todayLeave,
        total: todayTotal,
        presentRate: todayRate,
      },
      month: {
        monthName: now.toLocaleString("default", { month: "long", year: "numeric" }),
        present: monthPresent,
        absent: monthAbsent,
        halfDay: monthHalfDay,
        leave: monthLeave,
        total: monthTotal,
        presentRate: monthRate,
      },
      modeBreakdown: {
        faceAi: faceAiCount,
        manual: manualCount,
        total: modeTotal,
        faceAiRate,
      },
      dailyTrend,
    },
    faceAiMetrics: {
      totalAiVerifications: aiAggregate._count.id || 0,
      avgLivenessScore: aiAggregate._avg.livenessScore ? Number(aiAggregate._avg.livenessScore.toFixed(3)) : 0,
      avgConfidenceScore: aiAggregate._avg.confidenceScore ? Number(aiAggregate._avg.confidenceScore.toFixed(3)) : 0,
      avgQualityScore: aiAggregate._avg.qualityScore ? Number(aiAggregate._avg.qualityScore.toFixed(3)) : 0,
    },
    topFarmsActivity,
    comparisons,
  };
}
