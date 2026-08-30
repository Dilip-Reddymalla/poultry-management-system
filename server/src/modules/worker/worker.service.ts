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
  UpdateWorkerInput,
} from "./worker.schema.js";

import {getFarmById} from "../farm/farm.service.js"

import type { SafeWorker, WorkerPagination } from "./worker.types.js";

const workerSelect = {
  id: true,
  workerId: true,
  name: true,
  phone: true,
  photoUrl: true,
  status: true,
  farmId: true,
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
  return {
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
    ...(query.search !== undefined && {
      name: {
        contains: query.search,
        mode: "insensitive",
      },
    }),
  };

  const [workers, total] = await prisma.$transaction([
    prisma.worker.findMany({
      where,
      orderBy: {
        workerId: "asc",
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

export async function createWorkerId(scope:AuthScope,input:CreateWorkerInput):Promise<string>{
  const totalWorkers = await listWorkers(scope,{page:1,limit:1})
  const farmName = (await getFarmById(scope,input.farmId)).name;
  return `${farmName}-W${totalWorkers.pagination.total+1}`
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

  const newWorkerId:string = await createWorkerId(scope,input);

  const inputId = input.workerId;

  const finalWorkerId = inputId? inputId: newWorkerId;

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

    return toSafeWorker(worker);
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

    return toSafeWorker(worker);
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

  return toSafeWorker(worker);
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
