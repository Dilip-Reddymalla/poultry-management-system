import type { AttendanceStatus, Shift } from "@prisma/client";

// The person an attendance record is for. Exactly one kind per record; `code` is
// the human identifier (employeeId or workerId).
export interface SafeAttendancePerson {
  type: "EMPLOYEE" | "WORKER";
  id: string;
  code: string;
  name: string;
}

// A brief actor summary for the correction/approval lifecycle. Null when the
// actor was the System Admin (no user row) or the field is unset.
export interface SafeAttendanceActor {
  id: string;
  name: string;
}

// The record shape returned to clients. Internal/security columns
// (recordedById/approvedById foreign keys) are never exposed directly — only a
// safe id+name summary of the actor is.
export interface SafeAttendance {
  id: string;
  date: string;
  shift: Shift;
  status: AttendanceStatus;
  farmId: string;
  shedId: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  farm: {
    id: string;
    code: string;
    name: string;
  };
  shed?: {
    id: string;
    number: string;
  };
  person: SafeAttendancePerson;
  recordedBy: SafeAttendanceActor | null;
  approvedBy: SafeAttendanceActor | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendancePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
