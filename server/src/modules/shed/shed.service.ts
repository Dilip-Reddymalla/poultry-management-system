import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import type { AuthScope } from "../auth/scope.js";
import {
  assertFarmWritable,
  farmScopedWhere,
  isFarmInScope,
} from "../auth/scope.js";

import type {
  CreateShedInput,
  ListShedsQueryInput,
  UpdateShedInput,
  UpdateShedStatusInput,
} from "./shed.schema.js";
import type { SafeShed } from "./shed.types.js";

const shedSelect = {
  id: true,
  number: true,
  capacity: true,
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

type ShedRecord = Prisma.ShedGetPayload<{
  select: typeof shedSelect;
}>;

function toSafeShed(shed: ShedRecord): SafeShed {
  return {
    id: shed.id,
    number: shed.number,
    capacity: shed.capacity,
    status: shed.status,
    farm: {
      id: shed.farm.id,
      code: shed.farm.code,
      name: shed.farm.name,
    },
  };
}

// A read that must not leak existence: an out-of-scope shed is reported as not
// found rather than forbidden.
async function loadReadableShed(
  scope: AuthScope,
  id: string,
): Promise<ShedRecord> {
  const shed = await prisma.shed.findUnique({
    where: { id },
    select: shedSelect,
  });

  if (!shed || !isFarmInScope(scope, { companyId: shed.farm.companyId, id: shed.farmId })) {
    throw new AppError("Shed not found", 404);
  }

  return shed;
}

export async function listSheds(
  scope: AuthScope,
  query: ListShedsQueryInput,
): Promise<SafeShed[]> {
  const where: Prisma.ShedWhereInput = {
    // Scope enforced in the query; a farmId outside scope simply matches nothing.
    ...farmScopedWhere(scope),
    ...(query.farmId !== undefined && { farmId: query.farmId }),
    ...(query.status !== undefined && { status: query.status }),
  };

  const sheds = await prisma.shed.findMany({
    where,
    orderBy: {
      number: "asc",
    },
    select: shedSelect,
  });

  return sheds.map(toSafeShed);
}

export async function getShedById(
  scope: AuthScope,
  id: string,
): Promise<SafeShed> {
  return toSafeShed(await loadReadableShed(scope, id));
}

function toWriteError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new AppError("Shed number already exists for this farm", 409);
  }

  return error;
}

// A shed may only be created under an existing, active farm the caller may write
// to; sheds are never created against a farm that has been taken out of service.
async function assertFarmCreatable(
  scope: AuthScope,
  farmId: string,
): Promise<void> {
  const farm = await prisma.farm.findUnique({
    where: {
      id: farmId,
    },
    select: {
      id: true,
      status: true,
      companyId: true,
    },
  });

  if (!farm) {
    throw new AppError("Farm not found", 404);
  }

  assertFarmWritable(scope, { companyId: farm.companyId, id: farm.id });

  if (farm.status !== "ACTIVE") {
    throw new AppError("Cannot add a shed to an inactive farm", 409);
  }
}

export async function createShed(
  scope: AuthScope,
  input: CreateShedInput,
): Promise<SafeShed> {
  await assertFarmCreatable(scope, input.farmId);

  try {
    const shed = await prisma.shed.create({
      data: {
        farmId: input.farmId,
        number: input.number,
        capacity: input.capacity,
      },
      select: shedSelect,
    });

    return toSafeShed(shed);
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function updateShed(
  scope: AuthScope,
  id: string,
  input: UpdateShedInput,
): Promise<SafeShed> {
  const existingShed = await prisma.shed.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      farmId: true,
      farm: { select: { companyId: true } },
    },
  });

  if (!existingShed) {
    throw new AppError("Shed not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: existingShed.farm.companyId,
    id: existingShed.farmId,
  });

  try {
    const shed = await prisma.shed.update({
      where: {
        id,
      },
      data: {
        ...(input.number !== undefined && { number: input.number }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
      },
      select: shedSelect,
    });

    return toSafeShed(shed);
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function updateShedStatus(
  scope: AuthScope,
  id: string,
  input: UpdateShedStatusInput,
): Promise<SafeShed> {
  const existingShed = await prisma.shed.findUnique({
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

  if (!existingShed) {
    throw new AppError("Shed not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: existingShed.farm.companyId,
    id: existingShed.farmId,
  });

  // Occupancy is owned by the batch lifecycle, so an occupied shed cannot be
  // moved to another status here.
  if (existingShed.status === "OCCUPIED") {
    throw new AppError("Cannot change the status of an occupied shed", 409);
  }

  if (existingShed.status === input.status) {
    throw new AppError(`Shed is already ${input.status.toLowerCase()}`, 409);
  }

  const shed = await prisma.shed.update({
    where: {
      id,
    },
    data: {
      status: input.status,
    },
    select: shedSelect,
  });

  return toSafeShed(shed);
}
