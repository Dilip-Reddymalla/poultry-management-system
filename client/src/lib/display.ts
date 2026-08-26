import type {
  AttendanceStatus,
  EmployeeStatus,
  FarmStatus,
  ShedStatus,
} from "../api/types.js";

export type StatusTone = "running" | "busy" | "attention" | "idle";

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
    default:
      return "idle";
  }
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
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

export function statusLabel(status: string): string {
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
