import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit/audit.service.js";
import type { AuthScope } from "../auth/scope.js";
import {
  assertCompanyWritable,
  assertFarmWritable,
  farmModelScopedWhere,
  isFarmInScope,
} from "../auth/scope.js";

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
  companyId: true,
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

// Loads a farm and its owning company, reporting an out-of-scope farm as not
// found so its existence is never leaked across companies.
async function loadReadableFarm(
  scope: AuthScope,
  id: string,
): Promise<FarmRecord> {
  const farm = await prisma.farm.findUnique({
    where: { id },
    select: farmSelect,
  });

  if (!farm || !isFarmInScope(scope, { companyId: farm.companyId, id: farm.id })) {
    throw new AppError("Farm not found", 404);
  }

  return farm;
}

export async function listFarms(
  scope: AuthScope,
  query: ListFarmsQueryInput,
): Promise<SafeFarm[]> {
  const where: Prisma.FarmWhereInput = {
    // Scope is enforced in the query: a company user only ever sees its company's
    // farms, a farm user only its own farm.
    ...farmModelScopedWhere(scope),
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

export async function getFarmById(
  scope: AuthScope,
  id: string,
): Promise<SafeFarm> {
  return toSafeFarm(await loadReadableFarm(scope, id));
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

export async function createFarm(
  scope: AuthScope,
  input: CreateFarmInput,
): Promise<SafeFarm> {
  await assertCompanyExists(input.companyId);

  // A farm can only be created inside a company the caller may write to.
  assertCompanyWritable(scope, input.companyId);

  try {
    const farm = await prisma.farm.create({
      data: {
        companyId: input.companyId,
        code: input.code,
        name: input.name,
      },
      select: farmSelect,
    });

    const safeFarm = toSafeFarm(farm);
    void recordAuditLog({
      scope,
      action: "CREATE",
      entity: "Farm",
      entityId: farm.id,
      summary: `Created farm ${farm.name} (${farm.code})`,
      changes: { code: farm.code, name: farm.name, companyId: farm.companyId },
    });
    return safeFarm;
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function updateFarm(
  scope: AuthScope,
  id: string,
  input: UpdateFarmInput,
): Promise<SafeFarm> {
  const existingFarm = await prisma.farm.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      companyId: true,
    },
  });

  if (!existingFarm) {
    throw new AppError("Farm not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: existingFarm.companyId,
    id: existingFarm.id,
  });

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

async function setFarmStatus(
  scope: AuthScope,
  id: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<SafeFarm> {
  const existingFarm = await prisma.farm.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      status: true,
      companyId: true,
    },
  });

  if (!existingFarm) {
    throw new AppError("Farm not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: existingFarm.companyId,
    id: existingFarm.id,
  });

  if (existingFarm.status === status) {
    throw new AppError(
      status === "INACTIVE"
        ? "Farm is already inactive"
        : "Farm is already active",
      409,
    );
  }

  const farm = await prisma.farm.update({
    where: {
      id,
    },
    data: {
      status,
    },
    select: farmSelect,
  });

  return toSafeFarm(farm);
}

export async function deactivateFarm(
  scope: AuthScope,
  id: string,
): Promise<SafeFarm> {
  return setFarmStatus(scope, id, "INACTIVE");
}

export async function reactivateFarm(
  scope: AuthScope,
  id: string,
): Promise<SafeFarm> {
  return setFarmStatus(scope, id, "ACTIVE");
}
