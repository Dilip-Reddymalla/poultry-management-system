import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

import type { ListFarmsQueryInput } from "./farm.schema.js";
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
