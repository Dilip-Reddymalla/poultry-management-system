import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

import type {
  CreateFarmInput,
  ListFarmsQueryInput,
  UpdateFarmInput,
} from "./farm.schema.js";
import type { SafeFarm } from "./farm.types.js";

const farmSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  company: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
};

type FarmRecord = Prisma.FarmGetPayload<{
  select: typeof farmSelect;
}>;

function toSafeFarm(farm: FarmRecord): SafeFarm {
  return {
    id: farm.id,
    code: farm.code,
    name: farm.name,
    status: farm.status,
    company: {
      id: farm.company.id,
      name: farm.company.name,
      code: farm.company.code,
    },
  };
}

export async function listFarms(
  query: ListFarmsQueryInput,
): Promise<SafeFarm[]> {
  const where: Prisma.FarmWhereInput = {
    ...(query.status !== undefined && { status: query.status }),
  };

  const farms = await prisma.farm.findMany({
    where,
    orderBy: {
      code: "asc",
    },
    select: farmSelect,
  });

  return farms.map(toSafeFarm);
}

export async function getFarmById(id: string): Promise<SafeFarm> {
  const farm = await prisma.farm.findUnique({
    where: {
      id,
    },
    select: farmSelect,
  });

  if (!farm) {
    throw new AppError("Farm not found", 404);
  }

  return toSafeFarm(farm);
}

function toWriteError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new AppError("Farm code already exists for this company", 409);
  }

  return error;
}

async function assertCompanyExists(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
    },
  });

  if (!company) {
    throw new AppError("Company not found", 404);
  }
}

export async function createFarm(input: CreateFarmInput): Promise<SafeFarm> {
  await assertCompanyExists(input.companyId);

  try {
    const farm = await prisma.farm.create({
      data: {
        companyId: input.companyId,
        code: input.code,
        name: input.name,
      },
      select: farmSelect,
    });

    return toSafeFarm(farm);
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function updateFarm(
  id: string,
  input: UpdateFarmInput,
): Promise<SafeFarm> {
  const existingFarm = await prisma.farm.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
    },
  });

  if (!existingFarm) {
    throw new AppError("Farm not found", 404);
  }

  try {
    const farm = await prisma.farm.update({
      where: {
        id,
      },
      data: {
        ...(input.code !== undefined && { code: input.code }),
        ...(input.name !== undefined && { name: input.name }),
      },
      select: farmSelect,
    });

    return toSafeFarm(farm);
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function deactivateFarm(id: string): Promise<SafeFarm> {
  const existingFarm = await prisma.farm.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existingFarm) {
    throw new AppError("Farm not found", 404);
  }

  if (existingFarm.status === "INACTIVE") {
    throw new AppError("Farm is already inactive", 409);
  }

  const farm = await prisma.farm.update({
    where: {
      id,
    },
    data: {
      status: "INACTIVE",
    },
    select: farmSelect,
  });

  return toSafeFarm(farm);
}

export async function reactivateFarm(id: string): Promise<SafeFarm> {
  const existingFarm = await prisma.farm.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existingFarm) {
    throw new AppError("Farm not found", 404);
  }

  if (existingFarm.status === "ACTIVE") {
    throw new AppError("Farm is already active", 409);
  }

  const farm = await prisma.farm.update({
    where: {
      id,
    },
    data: {
      status: "ACTIVE",
    },
    select: farmSelect,
  });

  return toSafeFarm(farm);
}
