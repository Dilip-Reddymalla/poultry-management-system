import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

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
  farm: {
    select: {
      id: true,
      code: true,
      name: true,
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

export async function listSheds(
  query: ListShedsQueryInput,
): Promise<SafeShed[]> {
  const where: Prisma.ShedWhereInput = {
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

export async function getShedById(id: string): Promise<SafeShed> {
  const shed = await prisma.shed.findUnique({
    where: {
      id,
    },
    select: shedSelect,
  });

  if (!shed) {
    throw new AppError("Shed not found", 404);
  }

  return toSafeShed(shed);
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

// A shed may only be created under an existing, active farm; sheds are never
// created against a farm that has been taken out of service.
async function assertFarmIsActive(farmId: string): Promise<void> {
  const farm = await prisma.farm.findUnique({
    where: {
      id: farmId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!farm) {
    throw new AppError("Farm not found", 404);
  }

  if (farm.status !== "ACTIVE") {
    throw new AppError("Cannot add a shed to an inactive farm", 409);
  }
}

export async function createShed(input: CreateShedInput): Promise<SafeShed> {
  await assertFarmIsActive(input.farmId);

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
  id: string,
  input: UpdateShedInput,
): Promise<SafeShed> {
  const existingShed = await prisma.shed.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
    },
  });

  if (!existingShed) {
    throw new AppError("Shed not found", 404);
  }

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
    },
  });

  if (!existingShed) {
    throw new AppError("Shed not found", 404);
  }

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
