import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit/audit.service.js";
import type { AuthScope } from "../auth/scope.js";
import { assertFarmWritable, farmScopedWhere, isFarmInScope } from "../auth/scope.js";

import type {
  CreateAttendanceInput,
  ListAttendanceQueryInput,
  UpdateAttendanceInput,
  BulkCreateAttendanceInput,
  MarkedPersonIdsQueryInput,
  UnmarkedSummaryQueryInput,
  MarkUnmarkedAbsentInput,
} from "./attendance.schema.js";
import type {
  AttendancePagination,
  SafeAttendance,
  SafeAttendanceActor,
} from "./attendance.types.js";

// recordedBy/approvedBy expose only the actor's id and employee name — never the
// underlying user id columns or any credential field.
const actorSelect = {
  id: true,
  employee: {
    select: {
      name: true,
    },
  },
};

const attendanceSelect = {
  id: true,
  date: true,
  shift: true,
  status: true,
  latitude: true,
  longitude: true,
  notes: true,
  verificationMode: true,
  livenessScore: true,
  confidenceScore: true,
  snapshotUrl: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  farmId: true,
  shedId: true,
  farm: {
    select: {
      id: true,
      code: true,
      name: true,
      companyId: true,
    },
  },
  shed: {
    select: {
      id: true,
      number: true,
    },
  },
  employee: {
    select: {
      id: true,
      employeeId: true,
      name: true,
      photoUrl: true,
    },
  },
  worker: {
    select: {
      id: true,
      workerId: true,
      name: true,
      photoUrl: true,
    },
  },
  recordedBy: {
    select: actorSelect,
  },
  approvedBy: {
    select: actorSelect,
  },
} satisfies Prisma.AttendanceSelect;

type AttendanceRecord = Prisma.AttendanceGetPayload<{
  select: typeof attendanceSelect;
}>;

type ActorRecord = Prisma.UserGetPayload<{ select: typeof actorSelect }>;

function toSafeActor(actor: ActorRecord | null): SafeAttendanceActor | null {
  if (!actor) {
    return null;
  }

  return {
    id: actor.id,
    name: actor.employee.name,
  };
}

function toSafeAttendance(record: AttendanceRecord): SafeAttendance {
  // Exactly one of employee/worker is set (enforced at write time and by the
  // paired schema/column design).
  const person = record.employee
    ? {
        type: "EMPLOYEE" as const,
        id: record.employee.id,
        code: record.employee.employeeId,
        name: record.employee.name,
        photoUrl: record.employee.photoUrl ?? null,
      }
    : {
        type: "WORKER" as const,
        id: record.worker!.id,
        code: record.worker!.workerId,
        name: record.worker!.name,
        photoUrl: record.worker!.photoUrl ?? null,
      };

  return {
    id: record.id,
    // @db.Date comes back as a UTC-midnight Date; emit the plain calendar day.
    date: record.date.toISOString().slice(0, 10),
    shift: record.shift,
    status: record.status,
    farmId: record.farmId,
    shedId: record.shedId ?? null,
    latitude: record.latitude,
    longitude: record.longitude,
    notes: record.notes,
    farm: {
      id: record.farm.id,
      code: record.farm.code,
      name: record.farm.name,
    },
    ...(record.shed ? {
      shed: {
        id: record.shed.id,
        number: record.shed.number,
      },
    } : {}),
    person,
    recordedBy: toSafeActor(record.recordedBy),
    approvedBy: toSafeActor(record.approvedBy),
    approvedAt: record.approvedAt,
    verificationMode: record.verificationMode,
    livenessScore: record.livenessScore,
    confidenceScore: record.confidenceScore,
    snapshotUrl: record.snapshotUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// Resolves the person named in a create request to its farm, asserting the
// caller may write to that farm and that the person is active. The farm is taken
// from the person, never from the request body, so a record can never be
// attached to a farm the person does not belong to.
async function resolvePersonForWrite(
  scope: AuthScope,
  input: CreateAttendanceInput,
): Promise<{ farmId: string; shedId?: string; link: { employeeId: string } | { workerId: string } }> {
  if (input.employeeId !== undefined) {
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true,
        status: true,
        farmId: true,
        farm: { select: { companyId: true } },
      },
    });

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    assertFarmWritable(scope, {
      companyId: employee.farm.companyId,
      id: employee.farmId,
    });

    if (employee.status !== "ACTIVE") {
      throw new AppError(
        "Cannot record attendance for an inactive employee",
        409,
      );
    }

    // Validate shed if provided
    if (input.shedId) {
      const shed = await prisma.shed.findUnique({
        where: { id: input.shedId },
        select: { farmId: true },
      });
      if (!shed) {
        throw new AppError("Shed not found", 404);
      }
      if (shed.farmId !== employee.farmId) {
        throw new AppError("Shed does not belong to the person's farm", 400);
      }
    }

    return { 
      farmId: employee.farmId, 
      link: { employeeId: employee.id }, 
      ...(input.shedId ? { shedId: input.shedId } : {}) 
    };
  }

  const worker = await prisma.worker.findUnique({
    where: { id: input.workerId! },
    select: {
      id: true,
      status: true,
      farmId: true,
      farm: { select: { companyId: true } },
    },
  });

  if (!worker) {
    throw new AppError("Worker not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: worker.farm.companyId,
    id: worker.farmId,
  });

  if (worker.status !== "ACTIVE") {
    throw new AppError("Cannot record attendance for an inactive worker", 409);
  }

  // Validate shed if provided
  if (input.shedId) {
    const shed = await prisma.shed.findUnique({
      where: { id: input.shedId },
      select: { farmId: true },
    });
    if (!shed) {
      throw new AppError("Shed not found", 404);
    }
    if (shed.farmId !== worker.farmId) {
      throw new AppError("Shed does not belong to the person's farm", 400);
    }
  }

  return { 
    farmId: worker.farmId, 
    link: { workerId: worker.id }, 
    ...(input.shedId ? { shedId: input.shedId } : {}) 
  };
}

// A read that must not leak existence: an out-of-scope record is reported as not
// found rather than forbidden.
async function loadReadableAttendance(
  scope: AuthScope,
  id: string,
): Promise<AttendanceRecord> {
  const record = await prisma.attendance.findUnique({
    where: { id },
    select: attendanceSelect,
  });

  if (
    !record ||
    !isFarmInScope(scope, { companyId: record.farm.companyId, id: record.farmId })
  ) {
    throw new AppError("Attendance record not found", 404);
  }

  return record;
}

// Loads a record for a mutation, asserting the caller may write to its farm.
// Mutating an out-of-scope record is forbidden (403), not hidden.
async function loadWritableAttendance(scope: AuthScope, id: string) {
  const record = await prisma.attendance.findUnique({
    where: { id },
    select: {
      id: true,
      farmId: true,
      status: true,
      approvedAt: true,
      farm: { select: { companyId: true } },
    },
  });

  if (!record) {
    throw new AppError("Attendance record not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: record.farm.companyId,
    id: record.farmId,
  });

  return record;
}

export async function listAttendance(
  scope: AuthScope,
  query: ListAttendanceQueryInput,
): Promise<{ attendance: SafeAttendance[]; pagination: AttendancePagination }> {
  // Exact day wins; otherwise an inclusive from/to range if either bound is set.
  const dateFilter =
    query.date !== undefined
      ? query.date
      : query.from !== undefined || query.to !== undefined
        ? {
            ...(query.from !== undefined && { gte: query.from }),
            ...(query.to !== undefined && { lte: query.to }),
          }
        : undefined;

  const where: Prisma.AttendanceWhereInput = {
    // Attendance is always scoped to the caller's permitted farm/company.
    ...farmScopedWhere(scope),
    ...(query.farmId !== undefined && { farmId: query.farmId }),
    ...(query.shedId !== undefined && { shedId: query.shedId }),
    ...(query.employeeId !== undefined && { employeeId: query.employeeId }),
    ...(query.workerId !== undefined && { workerId: query.workerId }),
    ...(query.status !== undefined && { status: query.status }),
    ...(query.shift !== undefined && { shift: query.shift }),
    ...(query.recordedById !== undefined && { recordedById: query.recordedById }),
    ...(dateFilter !== undefined && { date: dateFilter }),
  };

  if (query.search) {
    where.OR = [
      { employee: { name: { contains: query.search, mode: "insensitive" } } },
      { worker: { name: { contains: query.search, mode: "insensitive" } } },
      { employee: { employeeId: { contains: query.search, mode: "insensitive" } } },
      { worker: { workerId: { contains: query.search, mode: "insensitive" } } },
      { employee: { phone: { contains: query.search } } },
      { worker: { phone: { contains: query.search } } },
    ];
  }

  const [records, total] = await prisma.$transaction([
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: attendanceSelect,
    }),
    prisma.attendance.count({ where }),
  ]);

  return {
    attendance: records.map(toSafeAttendance),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getAttendanceById(
  scope: AuthScope,
  id: string,
): Promise<SafeAttendance> {
  return toSafeAttendance(await loadReadableAttendance(scope, id));
}

export async function createAttendance(
  scope: AuthScope,
  input: CreateAttendanceInput,
): Promise<SafeAttendance> {
  const { farmId, shedId, link } = await resolvePersonForWrite(scope, input);

  try {
    const record = await prisma.attendance.create({
      data: {
        date: input.date,
        farmId,
        ...(shedId && { shedId }),
        ...link,
        shift: input.shift,
        status: input.status,
        latitude: input.latitude,
        longitude: input.longitude,
        ...(input.notes !== undefined && { notes: input.notes }),
        // Audit: who entered it. Null for the System Admin, which has no user row.
        recordedById: scope.userId,
        approvedById: scope.userId, // Initial attendance is automatically approved
        approvedAt: new Date(),
      },
      select: attendanceSelect,
    });

    const safeRecord = toSafeAttendance(record);
    void recordAuditLog({
      scope,
      action: "CREATE",
      entity: "Attendance",
      entityId: record.id,
      summary: `Marked ${record.status} attendance for ${safeRecord.person.name} (${safeRecord.person.code}) on ${safeRecord.date} [${safeRecord.shift}]`,
      changes: { status: record.status, shift: record.shift, date: input.date, latitude: input.latitude, longitude: input.longitude },
    });
    return safeRecord;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "Attendance has already been recorded for this person on this date and shift",
        409,
      );
    }

    throw error;
  }
}

export async function updateAttendance(
  scope: AuthScope,
  id: string,
  input: UpdateAttendanceInput,
): Promise<SafeAttendance> {
  await loadWritableAttendance(scope, id);

  const record = await prisma.attendance.update({
    where: { id },
    data: {
      ...(input.status !== undefined && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes }),
      // A correction reopens the record: any prior approval is cleared so a
      // manager/DGM must review and approve the corrected values again.
      approvedById: null,
      approvedAt: null,
    },
    select: attendanceSelect,
  });

  const safeRecord = toSafeAttendance(record);

  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "Attendance",
    entityId: record.id,
    summary: `Updated attendance for ${safeRecord.person.name} (${safeRecord.person.code}) on ${safeRecord.date} [${safeRecord.shift}]`,
    changes: {
      status: input.status,
      notes: input.notes,
    },
  });

  return safeRecord;
}

export async function approveAttendance(
  scope: AuthScope,
  id: string,
): Promise<SafeAttendance> {
  const existing = await loadWritableAttendance(scope, id);

  if (existing.approvedAt !== null) {
    throw new AppError("Attendance is already approved", 409);
  }

  const record = await prisma.attendance.update({
    where: { id },
    data: {
      // Audit: who finalized it. Null for the System Admin, which has no user row.
      approvedById: scope.userId,
      approvedAt: new Date(),
    },
    select: attendanceSelect,
  });

  const safeRecord = toSafeAttendance(record);

  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "Attendance",
    entityId: record.id,
    summary: `Approved attendance for ${safeRecord.person.name} (${safeRecord.person.code}) on ${safeRecord.date} [${safeRecord.shift}]`,
    changes: {
      approvedAt: record.approvedAt,
    },
  });

  return safeRecord;
}

export async function bulkCreateAttendance(
  scope: AuthScope,
  input: BulkCreateAttendanceInput,
) {
  const results = [];
  
  // Need to process one by one to validate scope and catch individual failures
  for (const recordInput of input.records) {
    try {
      const { farmId, shedId, link } = await resolvePersonForWrite(scope, recordInput);
      
      const record = await prisma.attendance.create({
        data: {
          date: recordInput.date,
          farmId,
          ...(shedId && { shedId }),
          ...link,
          shift: recordInput.shift,
          status: recordInput.status,
          latitude: recordInput.latitude,
          longitude: recordInput.longitude,
          ...(recordInput.notes !== undefined && { notes: recordInput.notes }),
          recordedById: scope.userId,
          approvedById: scope.userId, // Initial attendance is automatically approved
          approvedAt: new Date(),
        },
        select: attendanceSelect,
      });
      
      results.push({
        status: "fulfilled",
        value: toSafeAttendance(record),
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        results.push({
          status: "rejected",
          reason: "Attendance already recorded for this shift",
          input: recordInput,
        });
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.push({
          status: "rejected",
          reason: message,
          input: recordInput,
        });
      }
    }
  }

  const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
  if (fulfilledCount > 0) {
    void recordAuditLog({
      scope,
      action: "CREATE",
      entity: "Attendance",
      summary: `Bulk marked attendance for ${fulfilledCount} person(s)`,
      changes: {
        total: input.records.length,
        fulfilled: fulfilledCount,
        rejected: results.length - fulfilledCount,
      },
    });
  }

  return results;
}

// Returns the IDs of people already marked for a given date+shift+farm. Used by
// the frontend to hide them from the entry dialog so supervisors don't see
// already-marked people.
export async function getMarkedPersonIds(
  scope: AuthScope,
  query: MarkedPersonIdsQueryInput,
): Promise<{ employeeIds: string[]; workerIds: string[] }> {
  const records = await prisma.attendance.findMany({
    where: {
      ...farmScopedWhere(scope),
      farmId: query.farmId,
      date: query.date,
      shift: query.shift,
    },
    select: {
      employeeId: true,
      workerId: true,
    },
  });

  const employeeIds: string[] = [];
  const workerIds: string[] = [];

  for (const record of records) {
    if (record.employeeId) employeeIds.push(record.employeeId);
    if (record.workerId) workerIds.push(record.workerId);
  }

  return { employeeIds, workerIds };
}

// Previews unmarked employees and workers for a given farm, date, and shift.
export async function getUnmarkedSummary(
  scope: AuthScope,
  query: UnmarkedSummaryQueryInput,
): Promise<{
  unmarkedEmployees: { id: string; name: string; employeeId: string }[];
  unmarkedWorkers: { id: string; name: string; workerId: string }[];
  totalUnmarked: number;
}> {
  const farm = await prisma.farm.findUnique({
    where: { id: query.farmId },
    select: { id: true, companyId: true },
  });

  if (!farm || !isFarmInScope(scope, farm)) {
    throw new AppError("Farm not found", 404);
  }

  // 1. Get already marked person IDs
  const markedRecords = await prisma.attendance.findMany({
    where: {
      farmId: query.farmId,
      date: query.date,
      shift: query.shift,
    },
    select: {
      employeeId: true,
      workerId: true,
    },
  });

  const markedEmpIds = new Set(markedRecords.map((r) => r.employeeId).filter(Boolean));
  const markedWkrIds = new Set(markedRecords.map((r) => r.workerId).filter(Boolean));

  // 2. Fetch all active employees and workers on this farm
  const [allEmployees, allWorkers] = await Promise.all([
    prisma.employee.findMany({
      where: {
        farmId: query.farmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        photoUrl: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.worker.findMany({
      where: {
        farmId: query.farmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        workerId: true,
        photoUrl: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const unmarkedEmployees = allEmployees.filter((e) => !markedEmpIds.has(e.id));
  const unmarkedWorkers = allWorkers.filter((w) => !markedWkrIds.has(w.id));

  return {
    unmarkedEmployees,
    unmarkedWorkers,
    totalUnmarked: unmarkedEmployees.length + unmarkedWorkers.length,
  };
}

// Marks all currently unmarked active employees and/or workers as ABSENT for a specific shift and date.
export async function markUnmarkedAbsent(
  scope: AuthScope,
  input: MarkUnmarkedAbsentInput,
): Promise<{
  markedCount: number;
  employeeCount: number;
  workerCount: number;
  message: string;
}> {
  const farm = await prisma.farm.findUnique({
    where: { id: input.farmId },
    select: { id: true, name: true, companyId: true },
  });

  if (!farm) {
    throw new AppError("Farm not found", 404);
  }

  assertFarmWritable(scope, farm);

  if (input.shedId) {
    const shed = await prisma.shed.findUnique({
      where: { id: input.shedId },
      select: { farmId: true },
    });
    if (!shed) {
      throw new AppError("Shed not found", 404);
    }
    if (shed.farmId !== farm.id) {
      throw new AppError("Shed does not belong to the selected farm", 400);
    }
  }

  // 1. Fetch already marked attendance
  const markedRecords = await prisma.attendance.findMany({
    where: {
      farmId: input.farmId,
      date: input.date,
      shift: input.shift,
    },
    select: {
      employeeId: true,
      workerId: true,
    },
  });

  const markedEmpIds = new Set(markedRecords.map((r) => r.employeeId).filter(Boolean));
  const markedWkrIds = new Set(markedRecords.map((r) => r.workerId).filter(Boolean));

  // 2. Fetch active workforce targeted
  const shouldMarkEmployees = input.target === "ALL" || input.target === "EMPLOYEES";
  const shouldMarkWorkers = input.target === "ALL" || input.target === "WORKERS";

  const [activeEmployees, activeWorkers] = await Promise.all([
    shouldMarkEmployees
      ? prisma.employee.findMany({
          where: { farmId: input.farmId, status: "ACTIVE" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    shouldMarkWorkers
      ? prisma.worker.findMany({
          where: { farmId: input.farmId, status: "ACTIVE" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const unmarkedEmployees = activeEmployees.filter((e) => !markedEmpIds.has(e.id));
  const unmarkedWorkers = activeWorkers.filter((w) => !markedWkrIds.has(w.id));

  const totalToMark = unmarkedEmployees.length + unmarkedWorkers.length;

  if (totalToMark === 0) {
    return {
      markedCount: 0,
      employeeCount: 0,
      workerCount: 0,
      message: "No unmarked personnel found for this date and shift.",
    };
  }

  const defaultNote = input.notes?.trim() || "Marked absent (Unmarked roster cutoff)";
  const now = new Date();

  // 3. Batch insert ABSENT records
  const attendanceDataToInsert = [
    ...unmarkedEmployees.map((e) => ({
      date: input.date,
      farmId: input.farmId,
      employeeId: e.id,
      workerId: null,
      shedId: input.shedId ?? null,
      shift: input.shift,
      status: "ABSENT" as const,
      latitude: input.latitude,
      longitude: input.longitude,
      notes: defaultNote,
      recordedById: scope.userId,
      approvedById: scope.userId,
      approvedAt: now,
    })),
    ...unmarkedWorkers.map((w) => ({
      date: input.date,
      farmId: input.farmId,
      employeeId: null,
      workerId: w.id,
      shedId: input.shedId ?? null,
      shift: input.shift,
      status: "ABSENT" as const,
      latitude: input.latitude,
      longitude: input.longitude,
      notes: defaultNote,
      recordedById: scope.userId,
      approvedById: scope.userId,
      approvedAt: now,
    })),
  ];

  await prisma.attendance.createMany({
    data: attendanceDataToInsert,
    skipDuplicates: true,
  });

  void recordAuditLog({
    scope,
    action: "CREATE",
    entity: "Attendance",
    summary: `Marked ${totalToMark} unmarked personnel as ABSENT (${unmarkedEmployees.length} employees, ${unmarkedWorkers.length} workers) on ${farm.name} for ${input.date.toISOString().slice(0, 10)} [${input.shift}]`,
    changes: {
      target: input.target,
      markedCount: totalToMark,
      employeeCount: unmarkedEmployees.length,
      workerCount: unmarkedWorkers.length,
      shift: input.shift,
      date: input.date,
    },
  });

  return {
    markedCount: totalToMark,
    employeeCount: unmarkedEmployees.length,
    workerCount: unmarkedWorkers.length,
    message: `Successfully marked ${totalToMark} unmarked personnel as Absent.`,
  };
}
