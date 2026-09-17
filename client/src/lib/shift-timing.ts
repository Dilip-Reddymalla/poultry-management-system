import type { Shift } from "../api/types.js";

export interface ShiftTimingRule {
  shift: Shift;
  label: string;
  shortLabel: string;
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
    label: "Morning Shift (09:00 AM – 01:00 PM)",
    shortLabel: "Morning",
    timeRange: "09:00 AM – 01:00 PM",
    startHour: 9,
    startMinute: 0,
    endHour: 13,
    endMinute: 0,
  },
  AFTERNOON_SHIFT: {
    shift: "AFTERNOON_SHIFT",
    label: "Afternoon Shift (02:00 PM – 06:00 PM)",
    shortLabel: "Afternoon",
    timeRange: "02:00 PM – 06:00 PM",
    startHour: 14,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
  },
  NIGHT_SHIFT: {
    shift: "NIGHT_SHIFT",
    label: "Night Shift (07:00 PM – 04:00 AM)",
    shortLabel: "Night",
    timeRange: "07:00 PM – 04:00 AM",
    startHour: 19,
    startMinute: 0,
    endHour: 4,
    endMinute: 0,
    crossesMidnight: true,
  },
  OVERTIME: {
    shift: "OVERTIME",
    label: "Overtime (Anytime)",
    shortLabel: "Overtime",
    timeRange: "Anytime (24/7)",
    startHour: 0,
    startMinute: 0,
    endHour: 24,
    endMinute: 0,
  },
};

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
    isInWindow =
      currentTotalMinutes >= startTotalMinutes ||
      currentTotalMinutes <= endTotalMinutes;
  } else {
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
      message: `${rule.shortLabel} shift attendance must be recorded between ${rule.timeRange}. Current time is ${formattedNow}.`,
    };
  }

  return { allowed: true };
}
