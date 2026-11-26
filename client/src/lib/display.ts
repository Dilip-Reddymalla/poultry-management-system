import i18n from "../i18n/index.js";
import type {
  AttendanceStatus,
  EmployeeStatus,
  FarmStatus,
  ShedStatus,
} from "../api/types.js";

export type StatusTone = "running" | "busy" | "attention" | "idle" | "promoted";

export type AnyStatus =
  | EmployeeStatus
  | FarmStatus
  | ShedStatus
  | AttendanceStatus;

/**
 * Status colour is meaning, not decoration: moss is ready, clay is holding
 * birds, rust needs a person, grey is parked. Attendance reuses the same scale —
 * present is ready, absent needs attention, half day is partial, leave is parked.
 */
export function statusTone(status: AnyStatus | string): StatusTone {
  switch (status) {
    case "ACTIVE":
    case "AVAILABLE":
    case "PRESENT":
      return "running";
    case "OCCUPIED":
    case "HALF_DAY":
      return "busy";
    case "MAINTENANCE":
    case "ABSENT":
      return "attention";
    case "PROMOTED":
      return "promoted";
    default:
      return "idle";
  }
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PROMOTED: "Promoted",
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  MAINTENANCE: "Maintenance",
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  LEAVE: "Leave",
  MORNING_SHIFT: "Morning",
  AFTERNOON_SHIFT: "Afternoon",
  NIGHT_SHIFT: "Night",
  OVERTIME: "Overtime",
};

/**
 * Map a raw status/shift code to an i18n key. When the active language has a
 * translation it wins; otherwise we fall back to the English table below so the
 * UI never shows a bare code (e.g. "MORNING_SHIFT") to the user.
 */
const STATUS_I18N_KEYS: Record<string, string> = {
  ACTIVE: "status.active",
  INACTIVE: "status.inactive",
  PROMOTED: "status.promoted",
  AVAILABLE: "status.available",
  OCCUPIED: "status.occupied",
  MAINTENANCE: "status.maintenance",
  PRESENT: "status.present",
  ABSENT: "status.absent",
  HALF_DAY: "status.halfDay",
  LEAVE: "status.leave",
  MORNING_SHIFT: "status.morningShift",
  AFTERNOON_SHIFT: "status.afternoonShift",
  NIGHT_SHIFT: "status.nightShift",
  OVERTIME: "status.overtime",
};

export function statusLabel(status: string): string {
  const key = STATUS_I18N_KEYS[status];
  if (key) {
    const localized = i18n.t(key);
    // i18n returns the bare key when the resource is missing; treat that as
    // "untranslated" and fall back to the English table.
    if (localized && localized !== key) {
      return localized;
    }
  }
  return STATUS_LABELS[status] ?? status;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Value for a date input, which needs `yyyy-mm-dd`. */
export function toDateInputValue(value: string | null): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

/** Today's calendar day as `yyyy-mm-dd`, in the viewer's own timezone. */
export function todayInputValue(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** Clock time for a stored check-in/out, or a dash when none was recorded. */
export function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Combine an attendance day (`yyyy-mm-dd`) with a clock time (`HH:mm`) into an
 * ISO instant the API accepts, interpreting the time in the viewer's timezone.
 * Returns undefined when no time was entered.
 */
export function combineDateTime(
  date: string,
  time: string,
): string | undefined {
  if (!time) {
    return undefined;
  }

  const combined = new Date(`${date}T${time}`);

  return Number.isNaN(combined.getTime()) ? undefined : combined.toISOString();
}

/** Clock-time value (`HH:mm`) for a `<input type="time">` from a stored instant. */
export function toTimeInputValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function formatNumber(value: number | undefined): string {
  return value != null ? value.toLocaleString() : "—";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
