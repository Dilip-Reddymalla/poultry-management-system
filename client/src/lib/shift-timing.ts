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
  isEnabled?: boolean;
  source?: "FARM" | "COMPANY" | "DEFAULT";
}

export const SHIFT_TIMINGS: Record<Shift, ShiftTimingRule> = {
  MORNING_SHIFT: {
    shift: "MORNING_SHIFT",
    label: "Morning Shift (08:30 AM – 01:00 PM)",
    shortLabel: "Morning",
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
    label: "Afternoon Shift (02:00 PM – 06:00 PM)",
    shortLabel: "Afternoon",
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
    label: "Night Shift (07:00 PM – 04:00 AM)",
    shortLabel: "Night",
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
    label: "Overtime (Anytime)",
    shortLabel: "Overtime",
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

export function isTimeInShiftWindow(rule: ShiftTimingRule, date: Date = new Date()): boolean {
  if (rule.shift === "OVERTIME") return true;
  if (rule.isEnabled === false) return false;

  const currentTotalMinutes = date.getHours() * 60 + date.getMinutes();
  const startTotalMinutes = rule.startHour * 60 + rule.startMinute;
  const endTotalMinutes = rule.endHour * 60 + rule.endMinute;

  if (rule.crossesMidnight) {
    return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes;
  }
  return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
}

/**
 * Resolves the active shift corresponding to the current clock time.
 * Evaluates against the provided shift rules (or defaults).
 * If within a shift window, selects that shift; otherwise defaults to closest/MORNING_SHIFT.
 */
export function getCurrentShift(
  date: Date = new Date(),
  shiftRules: Record<Shift, ShiftTimingRule> = SHIFT_TIMINGS,
): Shift {
  // Test shifts in order of daytime progression
  const candidateShifts: Shift[] = ["MORNING_SHIFT", "AFTERNOON_SHIFT", "NIGHT_SHIFT"];
  for (const s of candidateShifts) {
    const rule = shiftRules[s];
    if (rule && isTimeInShiftWindow(rule, date)) {
      return s;
    }
  }

  // If outside standard windows (e.g. before dawn 05:00 AM or late night),
  // select Morning shift as the primary upcoming work shift
  return "MORNING_SHIFT";
}

export function validateShiftTiming(
  shift: Shift,
  date: Date = new Date(),
  shiftRules: Record<Shift, ShiftTimingRule> = SHIFT_TIMINGS,
): { allowed: boolean; message?: string } {
  if (shift === "OVERTIME") {
    return { allowed: true };
  }

  const rule = shiftRules[shift];
  if (!rule) {
    return { allowed: true };
  }

  if (rule.isEnabled === false) {
    return {
      allowed: false,
      message: `${rule.shortLabel || rule.label} shift is currently disabled for this location.`,
    };
  }

  if (!isTimeInShiftWindow(rule, date)) {
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
