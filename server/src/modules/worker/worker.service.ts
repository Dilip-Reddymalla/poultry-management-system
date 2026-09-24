import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { normalizePhone } from "../../utils/phone.js";
import type { AuthScope } from "../auth/scope.js";
import {
  assertFarmWritable,
  farmScopedWhere,
  isFarmInScope,
} from "../auth/scope.js";

import type {
  CreateWorkerInput,
  ListWorkersQueryInput,
  PromoteWorkerInput,
  UpdateWorkerInput,
} from "./worker.schema.js";

import { getFarmById } from "../farm/farm.service.js";
import { createEmployeeId, getEmployeeById } from "../employee/employee.service.js";
import type { SafeEmployee } from "../employee/employee.types.js";
import { recordAuditLog } from "../audit/audit.service.js";

import type { SafeWorker, WorkerPagination } from "./worker.types.js";

const workerSelect = {
  id: true,
  workerId: true,
  name: true,
  phone: true,
  photoUrl: true,
  status: true,
  farmId: true,
  promotedToEmployeeId: true,
  promotedAt: true,
  promotedToEmployee: {
    select: {
      id: true,
      employeeId: true,
      name: true,
    },
  },
  farm: {
    select: {
      id: true,
      code: true,
      name: true,
      companyId: true,
    },
  },
};

type WorkerRecord = Prisma.WorkerGetPayload<{
  select: typeof workerSelect;
}>;

function toSafeWorker(worker: WorkerRecord): SafeWorker {
  const safe: SafeWorker = {
    id: worker.id,
    workerId: worker.workerId,
    name: worker.name,
    phone: worker.phone,
    photoUrl: worker.photoUrl,
    status: worker.status,
    farm: {
      id: worker.farm.id,
      code: worker.farm.code,
      name: worker.farm.name,
    },
  };

  if (worker.status === "PROMOTED" || worker.promotedToEmployeeId) {
    safe.promotedToEmployeeId = worker.promotedToEmployeeId;
    safe.promotedAt = worker.promotedAt;
    safe.promotedToEmployee = worker.promotedToEmployee
      ? {
          id: worker.promotedToEmployee.id,
          employeeId: worker.promotedToEmployee.employeeId,
          name: worker.promotedToEmployee.name,
        }
      : null;
  }

  return safe;
}

function toWriteError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new AppError("Worker ID already exists", 409);
  }

  return error;
}

// The target farm must exist and be writable by the caller (403 otherwise).
async function assertFarmWritableById(
  scope: AuthScope,
  farmId: string,
): Promise<void> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true },
  });

  if (!farm) {
    throw new AppError("Farm not found", 404);
  }

  assertFarmWritable(scope, farm);
}

// A read that must not leak existence: an out-of-scope worker is reported as not
// found rather than forbidden.
async function loadReadableWorker(
  scope: AuthScope,
  id: string,
): Promise<WorkerRecord> {
  const worker = await prisma.worker.findUnique({
    where: { id },
    select: workerSelect,
  });

  if (
    !worker ||
    !isFarmInScope(scope, { companyId: worker.farm.companyId, id: worker.farmId })
  ) {
    throw new AppError("Worker not found", 404);
  }

  return worker;
}

export async function listWorkers(
  scope: AuthScope,
  query: ListWorkersQueryInput,
): Promise<{ workers: SafeWorker[]; pagination: WorkerPagination }> {
  const where: Prisma.WorkerWhereInput = {
    // Scope is enforced in the query, never in the frontend.
    ...farmScopedWhere(scope),
    ...(query.farmId !== undefined && { farmId: query.farmId }),
    ...(query.status !== undefined && { status: query.status }),
    ...(query.search && query.search.trim() !== ""
      ? {
          OR: [
            { name: { contains: query.search.trim(), mode: "insensitive" } },
            { workerId: { contains: query.search.trim(), mode: "insensitive" } },
            { phone: { contains: query.search.trim() } },
          ],
        }
      : {}),
  };

  const sortField = query.sortBy ?? "workerId";
  const sortOrder = query.sortOrder ?? "asc";

  const [workers, total] = await prisma.$transaction([
    prisma.worker.findMany({
      where,
      orderBy: {
        [sortField]: sortOrder,
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: workerSelect,
    }),
    prisma.worker.count({ where }),
  ]);

  return {
    workers: workers.map(toSafeWorker),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getWorkerById(
  scope: AuthScope,
  id: string,
): Promise<SafeWorker> {
  return toSafeWorker(await loadReadableWorker(scope, id));
}

export async function createWorkerId(
  scope: AuthScope,
  input: CreateWorkerInput,
): Promise<string> {
  const farm = await getFarmById(scope, input.farmId);
  let counter =
    (await prisma.worker.count({
      where: { farmId: input.farmId },
    })) + 1;

  let candidateId = `${farm.name}-W${counter}`;

  while (
    await prisma.worker.findUnique({
      where: { workerId: candidateId },
      select: { id: true },
    })
  ) {
    counter += 1;
    candidateId = `${farm.name}-W${counter}`;
  }

  return candidateId;
}

/** Optional face-AI data attached during create/update. */
export interface FaceEnrollmentData {
  photoUrl?: string | undefined;
  faceEmbedding?: number[] | undefined;
}

export async function createWorker(
  scope: AuthScope,
  input: CreateWorkerInput,
  faceData: FaceEnrollmentData = {},
): Promise<SafeWorker> {
  await assertFarmWritableById(scope, input.farmId);

  const trimmedWorkerId = input.workerId?.trim();
  const finalWorkerId = trimmedWorkerId
    ? trimmedWorkerId
    : await createWorkerId(scope, input);

  const existingWorker = await prisma.worker.findUnique({
    where: {
      workerId: finalWorkerId,
    },
    select: {
      id: true,
    },
  });

  if (existingWorker) {
    throw new AppError("Worker ID already exists", 409);
  }

  try {
    const worker = await prisma.worker.create({
      data: {
        workerId: finalWorkerId,
        name: input.name,
        farmId: input.farmId,
        ...(input.phone !== undefined && {
          phone: normalizePhone(input.phone),
        }),
        ...(faceData.photoUrl !== undefined && { photoUrl: faceData.photoUrl }),
      },
      select: workerSelect,
    });

    // Store face embedding via raw SQL (Prisma cannot write vector columns).
    if (faceData.faceEmbedding) {
      try {
        const vectorLiteral = `[${faceData.faceEmbedding.join(",")}]`;
        await prisma.$queryRawUnsafe(
          `UPDATE workers SET face_embedding = $1::vector WHERE id = $2`,
          vectorLiteral,
          worker.id,
        );
      } catch {
        await prisma.$queryRawUnsafe(
          `UPDATE workers SET face_embedding = $1::float8[] WHERE id = $2`,
          faceData.faceEmbedding,
          worker.id,
        );
      }
    }

    const safe = toSafeWorker(worker);

    void recordAuditLog({
      scope,
      action: "CREATE",
      entity: "Worker",
      entityId: worker.id,
      summary: `Created worker ${worker.name} (${worker.workerId})`,
      changes: {
        workerId: worker.workerId,
        name: worker.name,
        farmId: worker.farmId,
        phone: worker.phone,
      },
    });

    return safe;
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function updateWorker(
  scope: AuthScope,
  id: string,
  input: UpdateWorkerInput,
  faceData: FaceEnrollmentData = {},
): Promise<SafeWorker> {
  const existingWorker = await prisma.worker.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      farmId: true,
      farm: { select: { companyId: true } },
    },
  });

  if (!existingWorker) {
    throw new AppError("Worker not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: existingWorker.farm.companyId,
    id: existingWorker.farmId,
  });

  try {
    const worker = await prisma.worker.update({
      where: {
        id,
      },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && {
          phone: input.phone === null ? null : normalizePhone(input.phone),
        }),
        ...(faceData.photoUrl !== undefined && { photoUrl: faceData.photoUrl }),
      },
      select: workerSelect,
    });

    // Update face embedding via raw SQL.
    if (faceData.faceEmbedding) {
      try {
        const vectorLiteral = `[${faceData.faceEmbedding.join(",")}]`;
        await prisma.$queryRawUnsafe(
          `UPDATE workers SET face_embedding = $1::vector WHERE id = $2`,
          vectorLiteral,
          worker.id,
        );
      } catch {
        await prisma.$queryRawUnsafe(
          `UPDATE workers SET face_embedding = $1::float8[] WHERE id = $2`,
          faceData.faceEmbedding,
          worker.id,
        );
      }
    }

    const safe = toSafeWorker(worker);

    void recordAuditLog({
      scope,
      action: "UPDATE",
      entity: "Worker",
      entityId: worker.id,
      summary: `Updated worker ${worker.name} (${worker.workerId})`,
      changes: {
        name: input.name,
        phone: input.phone,
      },
    });

    return safe;
  } catch (error) {
    throw toWriteError(error);
  }
}

async function setWorkerStatus(
  scope: AuthScope,
  id: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<SafeWorker> {
  const existingWorker = await prisma.worker.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      status: true,
      farmId: true,
      farm: { select: { companyId: true } },
    },
  });

  if (!existingWorker) {
    throw new AppError("Worker not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: existingWorker.farm.companyId,
    id: existingWorker.farmId,
  });

  if (existingWorker.status === status) {
    throw new AppError(
      status === "INACTIVE"
        ? "Worker is already inactive"
        : "Worker is already active",
      409,
    );
  }

  const worker = await prisma.worker.update({
    where: {
      id,
    },
    data: {
      status,
    },
    select: workerSelect,
  });

  const safe = toSafeWorker(worker);

  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "Worker",
    entityId: worker.id,
    summary: `${status === "ACTIVE" ? "Reactivated" : "Deactivated"} worker ${worker.name} (${worker.workerId})`,
    changes: {
      status,
      previousStatus: existingWorker.status,
    },
  });

  return safe;
}

export async function deactivateWorker(
  scope: AuthScope,
  id: string,
): Promise<SafeWorker> {
  return setWorkerStatus(scope, id, "INACTIVE");
}

export async function reactivateWorker(
  scope: AuthScope,
  id: string,
): Promise<SafeWorker> {
  return setWorkerStatus(scope, id, "ACTIVE");
}

export async function deleteWorker(
  scope: AuthScope,
  id: string,
): Promise<{ success: boolean; message: string }> {
  const existingWorker = await prisma.worker.findUnique({
    where: { id },
    select: {
      id: true,
      workerId: true,
      name: true,
      farmId: true,
      farm: { select: { id: true, companyId: true } },
    },
  });

  if (!existingWorker) {
    throw new AppError("Worker not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: existingWorker.farm.companyId,
    id: existingWorker.farmId,
  });

  await prisma.$transaction(async (tx) => {
    // 1. Delete attendance records for this worker
    await tx.attendance.deleteMany({
      where: { workerId: id },
    });

    // 2. Delete worker record
    await tx.worker.delete({
      where: { id },
    });
  });

  void recordAuditLog({
    scope,
    action: "DELETE",
    entity: "Worker",
    entityId: id,
    summary: `Deleted worker ${existingWorker.name} (${existingWorker.workerId})`,
    changes: {
      workerId: existingWorker.workerId,
      name: existingWorker.name,
      farmId: existingWorker.farmId,
    },
  });

  return {
    success: true,
    message: `Worker ${existingWorker.name} deleted successfully`,
  };
}

export async function promoteWorker(
  scope: AuthScope,
  id: string,
  input: PromoteWorkerInput,
): Promise<SafeEmployee> {
  const existingWorker = await prisma.worker.findUnique({
    where: { id },
    include: {
      farm: { select: { id: true, companyId: true, name: true } },
    },
  });

  if (!existingWorker) {
    throw new AppError("Worker not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: existingWorker.farm.companyId,
    id: existingWorker.farmId,
  });

  if (existingWorker.status === "PROMOTED") {
    throw new AppError("Worker has already been promoted to an employee", 409);
  }

  if (existingWorker.status === "INACTIVE") {
    throw new AppError(
      "Cannot promote an inactive worker. Reactivate the worker first.",
      409,
    );
  }

  const designation = await prisma.designation.findUnique({
    where: { id: input.designationId },
    select: { id: true, name: true },
  });

  if (!designation) {
    throw new AppError("Designation not found", 404);
  }

  const resolvedEmployeeId = input.employeeId?.trim()
    ? input.employeeId.trim()
    : await createEmployeeId(scope, {
        farmId: existingWorker.farmId,
        name: input.name ?? existingWorker.name,
        designationId: input.designationId,
      });

  const duplicateEmployee = await prisma.employee.findUnique({
    where: { employeeId: resolvedEmployeeId },
    select: { id: true },
  });

  if (duplicateEmployee) {
    throw new AppError("Employee ID already exists", 409);
  }

  const createdEmployeeId = await prisma.$transaction(async (tx) => {
    // 1. Create the Employee record
    const employee = await tx.employee.create({
      data: {
        employeeId: resolvedEmployeeId,
        name: input.name ?? existingWorker.name,
        designationId: input.designationId,
        farmId: existingWorker.farmId,
        phone:
          input.phone !== undefined
            ? input.phone === null || input.phone === ""
              ? null
              : normalizePhone(input.phone)
            : existingWorker.phone,
        photoUrl: existingWorker.photoUrl,
        joiningDate: input.joiningDate ?? new Date(),
        status: "ACTIVE",
      },
    });

    // 2. Transfer face embedding from worker to employee, and nullify on worker
    // to prevent duplicate biometrics in Postgres.
    try {
      await tx.$executeRawUnsafe(
        `UPDATE employees SET face_embedding = (SELECT face_embedding FROM workers WHERE id = $1::uuid) WHERE id = $2::uuid`,
        existingWorker.id,
        employee.id,
      );
      await tx.$executeRawUnsafe(
        `UPDATE workers SET face_embedding = NULL WHERE id = $1::uuid`,
        existingWorker.id,
      );
    } catch {
      // In environments where pgvector extension is not enabled or vector type is simulated
    }

    // 3. Update Worker status to PROMOTED and link to new Employee
    await tx.worker.update({
      where: { id: existingWorker.id },
      data: {
        status: "PROMOTED",
        promotedToEmployeeId: employee.id,
        promotedAt: new Date(),
      },
    });

    return employee.id;
  });

  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "Worker",
    entityId: existingWorker.id,
    summary: `Worker ${existingWorker.name} (${existingWorker.workerId}) promoted to Employee (${resolvedEmployeeId})`,
    changes: {
      workerId: existingWorker.workerId,
      status: "PROMOTED",
      promotedToEmployeeId: createdEmployeeId,
      designationId: input.designationId,
      designationName: designation.name,
    },
  });

  void recordAuditLog({
    scope,
    action: "CREATE",
    entity: "Employee",
    entityId: createdEmployeeId,
    summary: `Created employee ${input.name ?? existingWorker.name} (${resolvedEmployeeId}) via promotion from worker ${existingWorker.workerId}`,
    changes: {
      employeeId: resolvedEmployeeId,
      name: input.name ?? existingWorker.name,
      farmId: existingWorker.farmId,
      promotedFromWorkerId: existingWorker.id,
    },
  });

  return getEmployeeById(scope, createdEmployeeId);
}


