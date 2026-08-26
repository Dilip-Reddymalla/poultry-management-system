import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import type { AuthScope } from "../auth/scope.js";
import {
  assertCompanyWritable,
  companyModelScopedWhere,
  isCompanyInScope,
} from "../auth/scope.js";

import type {
  CreateCompanyInput,
  UpdateCompanyInput,
} from "./company.schema.js";
import type { SafeCompany } from "./company.types.js";

const companySelect = {
  id: true,
  name: true,
  code: true,
  _count: {
    select: {
      farms: true,
    },
  },
};

type CompanyRecord = Prisma.CompanyGetPayload<{
  select: typeof companySelect;
}>;

function toSafeCompany(company: CompanyRecord): SafeCompany {
  return {
    id: company.id,
    name: company.name,
    code: company.code,
    farmCount: company._count.farms,
  };
}

export async function listCompanies(scope: AuthScope): Promise<SafeCompany[]> {
  // A company/farm user only ever sees its own company; the System Admin sees all.
  const where = companyModelScopedWhere(scope);

  const companies = await prisma.company.findMany({
    ...(where !== undefined && { where }),
    orderBy: {
      code: "asc",
    },
    select: companySelect,
  });

  return companies.map(toSafeCompany);
}

export async function getCompanyById(
  scope: AuthScope,
  id: string,
): Promise<SafeCompany> {
  const company = await prisma.company.findUnique({
    where: {
      id,
    },
    select: companySelect,
  });

  // Out-of-scope companies are reported as not found so their existence never
  // leaks to another company's users.
  if (!company || !isCompanyInScope(scope, company.id)) {
    throw new AppError("Company not found", 404);
  }

  return toSafeCompany(company);
}

function toWriteError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new AppError("Company code already exists", 409);
  }

  return error;
}

export async function createCompany(
  scope: AuthScope,
  input: CreateCompanyInput,
): Promise<SafeCompany> {
  // Creating a company is inherently a global action: there is no existing
  // company to scope it to. Only the global actor (System Admin) may do it.
  if (scope.level !== "GLOBAL") {
    throw new AppError("You do not have permission to perform this action", 403);
  }

  try {
    const company = await prisma.company.create({
      data: {
        name: input.name,
        code: input.code,
      },
      select: companySelect,
    });

    return toSafeCompany(company);
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function updateCompany(
  scope: AuthScope,
  id: string,
  input: UpdateCompanyInput,
): Promise<SafeCompany> {
  const existingCompany = await prisma.company.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
    },
  });

  if (!existingCompany) {
    throw new AppError("Company not found", 404);
  }

  // A Company Admin may manage its own company; anyone else is forbidden.
  assertCompanyWritable(scope, existingCompany.id);

  try {
    const company = await prisma.company.update({
      where: {
        id,
      },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.code !== undefined && { code: input.code }),
      },
      select: companySelect,
    });

    return toSafeCompany(company);
  } catch (error) {
    throw toWriteError(error);
  }
}
