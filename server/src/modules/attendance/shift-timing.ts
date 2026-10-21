import type { Shift } from "@prisma/client";
import { prisma } from "../../config/database.js";

export interface ShiftTimingRule {
  shift: Shift;
  label: string;
  timeRange: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  crossesMidnight?: boolean;
  isEnabled?: boolean;
  source?: "FARM" | "COMPANY" | "DEFAULT";
}

export const SHIFT_TIMINGS: Record<Shift, ShiftTimingRule> = {
  MORNING_SHIFT: {
    shift: "MORNING_SHIFT",
    label: "Morning Shift",
    timeRange: "08:30 AM – 01:00 PM",
    startHour: 8,
    startMinute: 30,
    endHour: 13,
    endMinute: 0,
    isEnabled: true,
    source: "DEFAULT",
  },
  AFTERNOON_SHIFT: {
    shift: "AFTERNOON_SHIFT",
    label: "Afternoon Shift",
    timeRange: "02:00 PM – 06:00 PM",
    startHour: 14,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
    isEnabled: true,
    source: "DEFAULT",
  },
  NIGHT_SHIFT: {
    shift: "NIGHT_SHIFT",
    label: "Night Shift",
    timeRange: "07:00 PM – 04:00 AM",
    startHour: 19,
    startMinute: 0,
    endHour: 4,
    endMinute: 0,
    crossesMidnight: true,
    isEnabled: true,
    source: "DEFAULT",
  },
  OVERTIME: {
    shift: "OVERTIME",
    label: "Overtime",
    timeRange: "Anytime (24/7)",
    startHour: 0,
    startMinute: 0,
    endHour: 24,
    endMinute: 0,
    isEnabled: true,
    source: "DEFAULT",
  },
};

export function formatTimeString(hour: number, minute: number): string {
  if (hour === 24 && minute === 0) return "12:00 AM";
  const period = hour >= 12 && hour < 24 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const paddedMinute = minute.toString().padStart(2, "0");
  return `${normalizedHour.toString().padStart(2, "0")}:${paddedMinute} ${period}`;
}

export function buildTimeRange(startHour: number, startMinute: number, endHour: number, endMinute: number): string {
  if (startHour === 0 && startMinute === 0 && endHour >= 24) {
    return "Anytime (24/7)";
  }
  return `${formatTimeString(startHour, startMinute)} – ${formatTimeString(endHour, endMinute)}`;
}

// In-memory cache for fast effective shift timing resolution
interface CachedShiftTimings {
  rules: Record<Shift, ShiftTimingRule>;
  expiresAt: number;
}
const shiftTimingCache = new Map<string, CachedShiftTimings>();
const SHIFT_CACHE_TTL = 30_000; // 30 seconds

export function invalidateShiftTimingCache(farmId?: string, companyId?: string): void {
  if (farmId) shiftTimingCache.delete(`farm:${farmId}`);
  if (companyId) shiftTimingCache.delete(`company:${companyId}`);
  if (!farmId && !companyId) shiftTimingCache.clear();
}

/**
 * Resolves effective shift timings for a farm with hierarchical inheritance:
 * Farm Specific Override -> Company Default -> System Default
 */
export async function getEffectiveShiftTimings(
  farmId?: string | null,
  companyId?: string | null,
): Promise<Record<Shift, ShiftTimingRule>> {
  const cacheKey = farmId ? `farm:${farmId}` : companyId ? `company:${companyId}` : "default";
  const now = Date.now();
  const cached = shiftTimingCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.rules;
  }

  // Clone default presets
  const result: Record<Shift, ShiftTimingRule> = {
    MORNING_SHIFT: { ...SHIFT_TIMINGS.MORNING_SHIFT },
    AFTERNOON_SHIFT: { ...SHIFT_TIMINGS.AFTERNOON_SHIFT },
    NIGHT_SHIFT: { ...SHIFT_TIMINGS.NIGHT_SHIFT },
    OVERTIME: { ...SHIFT_TIMINGS.OVERTIME },
  };

  let resolvedCompanyId = companyId;

  if (farmId && !resolvedCompanyId) {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: { companyId: true },
    });
    resolvedCompanyId = farm?.companyId ?? null;
  }

  // Apply company-level configurations if any
  if (resolvedCompanyId) {
    const companyTimings = await prisma.shiftTiming.findMany({
      where: { companyId: resolvedCompanyId, farmId: null },
    });
    for (const t of companyTimings) {
      result[t.shift] = {
        shift: t.shift,
        label: t.label,
        timeRange: buildTimeRange(t.startHour, t.startMinute, t.endHour, t.endMinute),
        startHour: t.startHour,
        startMinute: t.startMinute,
        endHour: t.endHour,
        endMinute: t.endMinute,
        crossesMidnight: t.crossesMidnight,
        isEnabled: t.isEnabled,
        source: "COMPANY",
      };
    }
  }

  // Apply farm-level overrides if any
  if (farmId) {
    const farmTimings = await prisma.shiftTiming.findMany({
      where: { farmId },
    });
    for (const t of farmTimings) {
      result[t.shift] = {
        shift: t.shift,
        label: t.label,
        timeRange: buildTimeRange(t.startHour, t.startMinute, t.endHour, t.endMinute),
        startHour: t.startHour,
        startMinute: t.startMinute,
        endHour: t.endHour,
        endMinute: t.endMinute,
        crossesMidnight: t.crossesMidnight,
        isEnabled: t.isEnabled,
        source: "FARM",
      };
    }
  }

  shiftTimingCache.set(cacheKey, { rules: result, expiresAt: now + SHIFT_CACHE_TTL });
  return result;
}

/**
 * Validates if the given clock time falls within the allowed recording window for a shift.
 * Supports farm-scoped effective shift timings.
 */
export async function validateShiftTiming(
  shift: Shift,
  date: Date = new Date(),
  farmId?: string | null,
): Promise<{ allowed: boolean; message?: string }> {
  if (shift === "OVERTIME") {
    return { allowed: true };
  }

  const effectiveTimings = await getEffectiveShiftTimings(farmId);
  const rule = effectiveTimings[shift];
  if (!rule) {
    return { allowed: true };
  }

  if (rule.isEnabled === false) {
    return {
      allowed: false,
      message: `${rule.label} is currently disabled for this location.`,
    };
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentTotalMinutes = hours * 60 + minutes;

  const startTotalMinutes = rule.startHour * 60 + rule.startMinute;
  const endTotalMinutes = rule.endHour * 60 + rule.endMinute;

  let isInWindow = false;

  if (rule.crossesMidnight) {
    // e.g. 19:00 to 04:00 -> current time >= 19:00 OR current time <= 04:00
    isInWindow =
      currentTotalMinutes >= startTotalMinutes ||
      currentTotalMinutes <= endTotalMinutes;
  } else {
    // e.g. 08:30 to 13:00 -> 08:30 <= current time <= 13:00
    isInWindow =
      currentTotalMinutes >= startTotalMinutes &&
      currentTotalMinutes <= endTotalMinutes;
  }

  if (!isInWindow) {
    const formattedNow = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      allowed: false,
      message: `${rule.label} attendance must be recorded between ${rule.timeRange}. Current time is ${formattedNow}.`,
    };
  }

  return { allowed: true };
}
