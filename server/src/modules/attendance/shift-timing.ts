import type { Shift } from "@prisma/client";

export interface ShiftTimingRule {
  shift: Shift;
  label: string;
  timeRange: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  crossesMidnight?: boolean;
}

export const SHIFT_TIMINGS: Record<Shift, ShiftTimingRule> = {
  MORNING_SHIFT: {
    shift: "MORNING_SHIFT",
    label: "Morning Shift",
    timeRange: "09:00 AM – 01:00 PM",
    startHour: 9,
    startMinute: 0,
    endHour: 13,
    endMinute: 0,
  },
  AFTERNOON_SHIFT: {
    shift: "AFTERNOON_SHIFT",
    label: "Afternoon Shift",
    timeRange: "02:00 PM – 06:00 PM",
    startHour: 14,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
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
  },
  OVERTIME: {
    shift: "OVERTIME",
    label: "Overtime",
    timeRange: "Anytime (24/7)",
    startHour: 0,
    startMinute: 0,
    endHour: 24,
    endMinute: 0,
  },
};

/**
 * Validates if the given clock time falls within the allowed recording window for a shift.
 * - MORNING_SHIFT: 09:00 to 13:00 (9 AM to 1 PM)
 * - AFTERNOON_SHIFT: 14:00 to 18:00 (2 PM to 6 PM)
 * - NIGHT_SHIFT: 19:00 to 04:00 (7 PM to 4 AM)
 * - OVERTIME: Anytime
 */
export function validateShiftTiming(
  shift: Shift,
  date: Date = new Date(),
): { allowed: boolean; message?: string } {
  if (shift === "OVERTIME") {
    return { allowed: true };
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentTotalMinutes = hours * 60 + minutes;

  const rule = SHIFT_TIMINGS[shift];
  if (!rule) {
    return { allowed: true };
  }

  const startTotalMinutes = rule.startHour * 60 + rule.startMinute;
  const endTotalMinutes = rule.endHour * 60 + rule.endMinute;

  let isInWindow = false;

  if (rule.crossesMidnight) {
    // e.g. 19:00 to 04:00 -> current time >= 19:00 OR current time <= 04:00
    isInWindow =
      currentTotalMinutes >= startTotalMinutes ||
      currentTotalMinutes <= endTotalMinutes;
  } else {
    // e.g. 09:00 to 13:00 -> 09:00 <= current time <= 13:00
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
