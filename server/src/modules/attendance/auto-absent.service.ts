import type { Shift } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { getEffectiveShiftTimings } from "./shift-timing.js";

// Shifts subject to automatic absent cutoffs (OVERTIME and NIGHT_SHIFT are never auto-marked absent)
const OPERATIONAL_SHIFTS: Shift[] = [
  "MORNING_SHIFT",
  "AFTERNOON_SHIFT",
];

// Grace period after shift ends before auto-marking absent (5 minutes)
const AUTO_ABSENT_GRACE_MINUTES = 5;

export interface AutoAbsentExecutionSummary {
  farmsEvaluated: number;
  shiftsChecked: number;
  totalMarkedAbsent: number;
  details: Array<{
    farmId: string;
    farmName: string;
    shift: Shift;
    date: string;
    markedCount: number;
  }>;
}

/**
 * Checks all active farms and evaluates whether any regular shifts have concluded
 * (shift end time + 5 minutes grace buffer) on the current day.
 * For any expired shift, any active employee or worker without an attendance record
 * on that date/shift is recorded as ABSENT.
 *
 * Submissions that are waiting for approval (e.g. out-of-geofence or IP fallback)
 * already have an Attendance row in the database, so they are NEVER marked absent.
 */
export async function processAutoAbsentCutoffs(
  referenceDate: Date = new Date(),
): Promise<AutoAbsentExecutionSummary> {
  const summary: AutoAbsentExecutionSummary = {
    farmsEvaluated: 0,
    shiftsChecked: 0,
    totalMarkedAbsent: 0,
    details: [],
  };

  const activeFarms = await prisma.farm.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      code: true,
      name: true,
      companyId: true,
      latitude: true,
      longitude: true,
    },
  });

  summary.farmsEvaluated = activeFarms.length;

  const currentHours = referenceDate.getHours();
  const currentMinutes = referenceDate.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  // Build calendar date strings (YYYY-MM-DD)
  const todayStr = referenceDate.toISOString().slice(0, 10);
  const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const yesterdayDate = new Date(`${yesterdayStr}T00:00:00.000Z`);

  for (const farm of activeFarms) {
    const effectiveTimings = await getEffectiveShiftTimings(
      farm.id,
      farm.companyId,
    );

    for (const shift of OPERATIONAL_SHIFTS) {
      summary.shiftsChecked++;
      const rule = effectiveTimings[shift];
      if (!rule || rule.isEnabled === false) {
        continue;
      }

      // Calculate shift cutoff time in minutes
      const endTotalMinutes = rule.endHour * 60 + rule.endMinute;
      const cutoffTotalMinutes = endTotalMinutes + AUTO_ABSENT_GRACE_MINUTES;

      let shouldProcess = false;
      let targetDate: Date = todayDate;
      let targetDateStr: string = todayStr;

      if (!rule.crossesMidnight) {
        // Normal shift ending same day (e.g., Morning ends at 13:00 -> cutoff 13:05)
        if (currentTotalMinutes >= cutoffTotalMinutes) {
          shouldProcess = true;
          targetDate = todayDate;
          targetDateStr = todayStr;
        }
      } else {
        // Shift crosses midnight (e.g. Night Shift 19:00 -> 04:00)
        // At 04:05 AM today, the 5-minute grace period has elapsed for YESTERDAY's Night Shift
        if (
          currentTotalMinutes >= cutoffTotalMinutes &&
          currentTotalMinutes < 12 * 60
        ) {
          shouldProcess = true;
          targetDate = yesterdayDate;
          targetDateStr = yesterdayStr;
        }
      }

      if (!shouldProcess) {
        continue;
      }

      // 1. Fetch all people already recorded for this farm, date, and shift.
      // NOTE: Records waiting for approval (e.g. location offset / IP fallback)
      // are already in this table, so they will NEVER be marked absent!
      const markedRecords = await prisma.attendance.findMany({
        where: {
          farmId: farm.id,
          date: targetDate,
          shift,
        },
        select: {
          employeeId: true,
          workerId: true,
        },
      });

      const markedEmpIds = new Set(
        markedRecords.map((r) => r.employeeId).filter(Boolean),
      );
      const markedWkrIds = new Set(
        markedRecords.map((r) => r.workerId).filter(Boolean),
      );

      // 2. Fetch active workforce on this farm
      const [activeEmployees, activeWorkers] = await Promise.all([
        prisma.employee.findMany({
          where: { farmId: farm.id, status: "ACTIVE" },
          select: { id: true, name: true },
        }),
        prisma.worker.findMany({
          where: { farmId: farm.id, status: "ACTIVE" },
          select: { id: true, name: true },
        }),
      ]);

      const unmarkedEmployees = activeEmployees.filter(
        (e) => !markedEmpIds.has(e.id),
      );
      const unmarkedWorkers = activeWorkers.filter(
        (w) => !markedWkrIds.has(w.id),
      );

      const toMarkCount =
        unmarkedEmployees.length + unmarkedWorkers.length;

      if (toMarkCount === 0) {
        continue;
      }

      const defaultLat = farm.latitude ?? 0;
      const defaultLon = farm.longitude ?? 0;
      const locationSource = farm.latitude ? "FARM_DEFAULT" : "GPS_EXACT";
      const now = new Date();

      const absentData = [
        ...unmarkedEmployees.map((e) => ({
          date: targetDate,
          farmId: farm.id,
          employeeId: e.id,
          workerId: null,
          shift,
          status: "ABSENT" as const,
          latitude: defaultLat,
          longitude: defaultLon,
          locationSource,
          notes: `Auto-marked absent (Shift cutoff + ${AUTO_ABSENT_GRACE_MINUTES}m grace)`,
          recordedById: null,
          approvedById: null,
          approvedAt: now,
        })),
        ...unmarkedWorkers.map((w) => ({
          date: targetDate,
          farmId: farm.id,
          employeeId: null,
          workerId: w.id,
          shift,
          status: "ABSENT" as const,
          latitude: defaultLat,
          longitude: defaultLon,
          locationSource,
          notes: `Auto-marked absent (Shift cutoff + ${AUTO_ABSENT_GRACE_MINUTES}m grace)`,
          recordedById: null,
          approvedById: null,
          approvedAt: now,
        })),
      ];

      await prisma.attendance.createMany({
        data: absentData,
        skipDuplicates: true,
      });

      summary.totalMarkedAbsent += toMarkCount;
      summary.details.push({
        farmId: farm.id,
        farmName: farm.name,
        shift,
        date: targetDateStr,
        markedCount: toMarkCount,
      });

      logger.info(
        `[AutoAbsent] Automatically marked ${toMarkCount} unmarked personnel as ABSENT on ${farm.name} for ${shift} on ${targetDateStr}`,
      );
    }
  }

  return summary;
}

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Starts the periodic background worker running every 5 minutes.
 */
export function startAutoAbsentScheduler(): void {
  if (schedulerTimer) return;

  // Run initial check 10 seconds after server startup
  setTimeout(() => {
    void processAutoAbsentCutoffs().catch((error) => {
      logger.error({ error }, "[AutoAbsent] Initial check error");
    });
  }, 10_000);

  // Run recurring check every 5 minutes
  schedulerTimer = setInterval(() => {
    void processAutoAbsentCutoffs().catch((error) => {
      logger.error({ error }, "[AutoAbsent] Recurring check error");
    });
  }, 5 * 60_000);

  logger.info("⏱️  Auto-absent background scheduler initialized (runs every 5m)");
}

/**
 * Stops the periodic background worker gracefully.
 */
export function stopAutoAbsentScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("⏹️  Auto-absent background scheduler stopped");
  }
}
