export type ScopeLevel = "FARM" | "COMPANY" | "GLOBAL";
export type FarmStatus = "ACTIVE" | "INACTIVE";
export type ShedStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "INACTIVE";
export type EmployeeStatus = "ACTIVE" | "INACTIVE";
export type WorkerStatus = "ACTIVE" | "INACTIVE";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
export type Shift = "MORNING_SHIFT" | "AFTERNOON_SHIFT" | "NIGHT_SHIFT" | "OVERTIME";
export type PersonType = "EMPLOYEE" | "WORKER";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "LEAVE",
];

export const SHIFTS: Shift[] = [
  "MORNING_SHIFT",
  "AFTERNOON_SHIFT",
  "NIGHT_SHIFT",
  "OVERTIME",
];

export interface ErrorResponse {
  message: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SessionUser {
  id: string;
  email: string;
  isSystemAdmin: boolean;
  mustSetPassword?: boolean;
  role: string;
  roles: string[];
  permissions: string[];
  employeeId: string;
  scope: {
    level: "FARM" | "COMPANY" | "GLOBAL";
    companyId: string | null;
    farmId: string | null;
  };
  employee: {
    id: string;
    name: string;
    designation: {
      id: string;
      name: string;
    };
  };
}

export interface AuthResponse {
  user: SessionUser;
}

export interface Company {
  id: string;
  name: string;
  code: string;
  gstin?: string;
  pan?: string;
  address?: string;
  farmCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Farm {
  id: string;
  companyId: string;
  name: string;
  code: string;
  status: FarmStatus;
  location?: string;
  company: Company;
  createdAt: string;
  updatedAt: string;
}

export interface Shed {
  id: string;
  farmId: string;
  number: string;
  capacity?: number;
  status: ShedStatus;
  farm: any;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string | null;
  phone: string | null;
  designation: {
    id: string;
    name: string;
  };
  farmId: string | null;
  farm: {
    id: string;
    code: string;
    name: string;
  };
  status: EmployeeStatus;
  hasUser?: boolean;
  photoUrl?: string;
  joiningDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  workerId: string;
  name: string;
  phone: string;
  farmId: string;
  farm: any;
  status: WorkerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AttendancePerson {
  type: "EMPLOYEE" | "WORKER";
  id: string;
  code: string;
  name: string;
}

export interface AttendanceActor {
  id: string;
  name: string;
}

export interface Attendance {
  id: string;
  farmId: string;
  farm: {
    id: string;
    name: string;
    code: string;
  };
  employeeId: string | null;
  workerId: string | null;
  person: {
    id: string;
    name: string;
    code: string;
    type: PersonType;
  };
  shedId: string | null;
  shed?: {
    id: string;
    number: string;
    capacity?: number;
  };
  date: string;
  shift: Shift;
  status: AttendanceStatus;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  recordedById: string;
  recordedBy?: {
    id: string;
    name: string;
  };
  approvedById: string | null;
  approvedBy?: {
    id: string;
    name: string;
  };
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Designation {
  id: string;
  name: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export type ManageableShedStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "INACTIVE";
export const MANAGEABLE_SHED_STATUSES: ManageableShedStatus[] = ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "INACTIVE"];

export interface PhoneAccount {
  id: string;
  name: string;
  phone: string;
  designation: {
    id: string;
    name: string;
  };
  employeeId: string;
  otp?: string;
}