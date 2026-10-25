export type ScopeLevel = "FARM" | "COMPANY" | "GLOBAL";
export type FarmStatus = "ACTIVE" | "INACTIVE";
export type ShedStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "INACTIVE";
export type EmployeeStatus = "ACTIVE" | "INACTIVE";
export type WorkerStatus = "ACTIVE" | "INACTIVE" | "PROMOTED";
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
    photoUrl?: string | null;
    joiningDate?: string | null;
    phone?: string | null;
  };
  company?: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
  } | null;
}

export interface AuthResponse {
  user: SessionUser;
}

export interface Company {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  website?: string | null;
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
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadius?: number | null;
  autoAbsentEnabled?: boolean;
  autoAbsentGraceMinutes?: number;
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
  employeeId?: string;
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
  user?: {
    id: string;
    email: string;
    roles: Array<{ id: string; name: string }>;
  } | null;
  photoUrl?: string;
  joiningDate?: string;
  promotedFromWorker?: {
    id: string;
    workerId: string;
    name: string;
    promotedAt?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  workerId?: string;
  name: string;
  phone: string;
  photoUrl?: string | null;
  farmId: string;
  farm: any;
  status: WorkerStatus;
  promotedToEmployeeId?: string | null;
  promotedAt?: string | null;
  promotedToEmployee?: {
    id: string;
    employeeId: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendancePerson {
  type: "EMPLOYEE" | "WORKER";
  id: string;
  code: string;
  name: string;
  photoUrl?: string | null;
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
    photoUrl?: string | null;
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
  locationSource?: string;
  accuracy?: number | null;
  ipAddress?: string | null;
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
  verificationMode?: string | null;
  livenessScore?: number | null;
  confidenceScore?: number | null;
  snapshotUrl?: string | null;
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
  rank?: number;
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

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditLog {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  summary: string;
  changes: Record<string, any> | null;
  actorId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRoles: string[] | null;
  companyName: string | null;
  farmName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ShiftTimingItem {
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

export interface Permission {
  id: string;
  name: string;
  description: string | null;
}

export interface SystemRoleConfigItem {
  id: string;
  name: string;
  description: string | null;
  scopeLevel: string;
  rank: number;
  isEnabled: boolean;
  companyEnabled?: boolean;
  permissionCount: number;
}

export interface CustomRoleConfigItem {
  id: string;
  name: string;
  description: string | null;
  scopeLevel: string;
  rank: number;
  isActive: boolean;
  permissions: Permission[];
  userCount: number;
}

export interface FarmRolesConfigResponse {
  farmId: string;
  systemRoles: SystemRoleConfigItem[];
  customRoles: CustomRoleConfigItem[];
}

export interface CompanyRoleConfigItem {
  id: string;
  name: string;
  description: string | null;
  scopeLevel: string;
  rank: number;
  defaultRank: number;
  customRank: number | null;
  isEnabled: boolean;
  isCompulsory: boolean;
  permissionCount: number;
  isCustom?: boolean;
  permissions?: Permission[];
  userCount?: number;
}

export interface CompanyRolesConfigResponse {
  companyId: string;
  systemRoles: CompanyRoleConfigItem[];
  customRoles?: CompanyRoleConfigItem[];
}

export interface CreateCompanyCustomRoleInput {
  name: string;
  description?: string;
  scopeLevel?: "COMPANY" | "FARM";
  permissionIds: string[];
  rank?: number;
}

export interface UpdateCompanyCustomRoleInput {
  name?: string;
  description?: string;
  scopeLevel?: "COMPANY" | "FARM";
  permissionIds?: string[];
  rank?: number;
  isActive?: boolean;
}

export interface CompanyRoleHierarchyInputItem {
  roleId: string;
  isEnabled: boolean;
  customRank?: number | null;
}


export interface FarmAttendanceReportSummary {
  farmId: string;
  farmCode: string;
  farmName: string;
  companyId: string;
  companyName: string;
  totalWorkforce: number;
  totalEmployees: number;
  totalWorkers: number;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  leaveCount: number;
  unmarkedCount: number;
  attendanceRate: number;
  shiftsBreakdown: Record<Shift, { present: number; absent: number; halfDay: number; leave: number }>;
  flaggedIpFallbacks: number;
  pendingApprovals: number;
}

export interface DailyTrendItem {
  date: string;
  dayLabel: string;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  attendanceRate: number;
}

export interface FarmComparisonItem {
  farmId: string;
  farmCode: string;
  farmName: string;
  companyName: string;
  attendanceRate: number;
  deltaFromAvg: number;
  rank: number;
  totalWorkforce: number;
  presentCount: number;
  absentCount: number;
  isBest: boolean;
  isWorst: boolean;
}

export interface EnterpriseAttendanceReportResponse {
  dateRange: {
    from: string;
    to: string;
    isSingleDay: boolean;
  };
  isSystemAdmin: boolean;
  scopeLevel: string;
  overview: {
    totalCompanies: number;
    totalFarms: number;
    totalWorkforce: number;
    overallAttendanceRate: number;
    totalPresent: number;
    totalAbsent: number;
    totalHalfDay: number;
    totalLeave: number;
    totalUnmarked: number;
    totalPendingApprovals: number;
    totalFlaggedIpFallbacks: number;
  };
  farms: FarmAttendanceReportSummary[];
  trends: DailyTrendItem[];
  farmComparison: FarmComparisonItem[] | null;
}
