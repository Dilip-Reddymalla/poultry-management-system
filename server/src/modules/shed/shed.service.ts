import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

import type { ListShedsQueryInput } from "./shed.schema.js";
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
