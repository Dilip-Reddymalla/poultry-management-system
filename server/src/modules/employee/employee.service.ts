import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { hashPassword } from "../../utils/password.js";
import { normalizePhone } from "../../utils/phone.js";

import type {
  CreateEmployeeInput,
  ListEmployeesQueryInput,
  ProvisionUserInput,
  UpdateEmployeeInput,
} from "./employee.schema.js";
import type {
  EmployeePagination,
  SafeEmployee,
} from "./employee.types.js";
import type { SafeUser } from "../auth/auth.types.js";

// User is selected by id only, so no sensitive user field can ever be returned.
const employeeSelect = {
  id: true,
  employeeId: true,
  name: true,
  phone: true,
  photoUrl: true,
  joiningDate: true,
  status: true,
  designation: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    select: {
      id: true,
    },
  },
};

type EmployeeRecord = Prisma.EmployeeGetPayload<{
  select: typeof employeeSelect;
}>;

function toSafeEmployee(employee: EmployeeRecord): SafeEmployee {
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    phone: employee.phone,
    photoUrl: employee.photoUrl,
    joiningDate: employee.joiningDate,
    status: employee.status,
    designation: {
      id: employee.designation.id,
      name: employee.designation.name,
    },
    hasUser: employee.user !== null,
  };
}

function toWriteError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new AppError("Employee ID already exists", 409);
  }

  return error;
}

async function assertDesignationExists(designationId: string): Promise<void> {
  const designation = await prisma.designation.findUnique({
    where: {
      id: designationId,
    },
    select: {
      id: true,
    },
  });

  if (!designation) {
    throw new AppError("Designation not found", 404);
  }
}

export async function listEmployees(
  query: ListEmployeesQueryInput,
): Promise<{ employees: SafeEmployee[]; pagination: EmployeePagination }> {
  const where: Prisma.EmployeeWhereInput = {
    ...(query.status !== undefined && { status: query.status }),
    ...(query.designationId !== undefined && {
      desiginationId: query.designationId,
    }),
    ...(query.search !== undefined && {
      name: {
        contains: query.search,
        mode: "insensitive",
      },
    }),
  };

  const [employees, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      orderBy: {
        employeeId: "asc",
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: employeeSelect,
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    employees: employees.map(toSafeEmployee),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getEmployeeById(id: string): Promise<SafeEmployee> {
  const employee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: employeeSelect,
  });

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  return toSafeEmployee(employee);
}

export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<SafeEmployee> {
  await assertDesignationExists(input.designationId);

  const existingEmployee = await prisma.employee.findUnique({
    where: {
      employeeId: input.employeeId,
    },
    select: {
      id: true,
    },
  });

  if (existingEmployee) {
    throw new AppError("Employee ID already exists", 409);
  }

  try {
    const employee = await prisma.employee.create({
      data: {
        employeeId: input.employeeId,
        name: input.name,
        desiginationId: input.designationId,
        ...(input.phone !== undefined && {
          phone: normalizePhone(input.phone),
        }),
        ...(input.photoUrl !== undefined && { photoUrl: input.photoUrl }),
        ...(input.joiningDate !== undefined && {
          joiningDate: input.joiningDate,
        }),
      },
      select: employeeSelect,
    });

    return toSafeEmployee(employee);
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
): Promise<SafeEmployee> {
  const existingEmployee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
    },
  });

  if (!existingEmployee) {
    throw new AppError("Employee not found", 404);
  }

  if (input.designationId !== undefined) {
    await assertDesignationExists(input.designationId);
  }

  try {
    const employee = await prisma.employee.update({
      where: {
        id,
      },
      // Nullable fields are only present when the client sent them, so an
      // omitted field is left unchanged while an explicit null clears it.
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.designationId !== undefined && {
          desiginationId: input.designationId,
        }),
        ...(input.phone !== undefined && {
          phone: input.phone === null ? null : normalizePhone(input.phone),
        }),
        ...(input.photoUrl !== undefined && { photoUrl: input.photoUrl }),
        ...(input.joiningDate !== undefined && {
          joiningDate: input.joiningDate,
        }),
      },
      select: employeeSelect,
    });

    return toSafeEmployee(employee);
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function deactivateEmployee(id: string): Promise<SafeEmployee> {
  const existingEmployee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existingEmployee) {
    throw new AppError("Employee not found", 404);
  }

  if (existingEmployee.status === "INACTIVE") {
    throw new AppError("Employee is already inactive", 409);
  }

  const employee = await prisma.employee.update({
    where: {
      id,
    },
    data: {
      status: "INACTIVE",
    },
    select: employeeSelect,
  });

  return toSafeEmployee(employee);
}

export async function reactivateEmployee(id: string): Promise<SafeEmployee> {
  const existingEmployee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existingEmployee) {
    throw new AppError("Employee not found", 404);
  }

  if (existingEmployee.status === "ACTIVE") {
    throw new AppError("Employee is already active", 409);
  }

  const employee = await prisma.employee.update({
    where: {
      id,
    },
    data: {
      status: "ACTIVE",
    },
    select: employeeSelect,
  });

  return toSafeEmployee(employee);
}

// Selects only non-sensitive fields needed to build a SafeUser response; the
// passwordHash is never read back.
const provisionEmployeeSelect = {
  id: true,
  employeeId: true,
  name: true,
  status: true,
  designation: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    select: {
      id: true,
    },
  },
};

export async function provisionEmployeeUser(
  id: string,
  input: ProvisionUserInput,
): Promise<SafeUser> {
  const employee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: provisionEmployeeSelect,
  });

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      "Cannot provision a login for an inactive employee",
      409,
    );
  }

  if (employee.user !== null) {
    throw new AppError("Employee already has a user account", 409);
  }

  const role = await prisma.role.findUnique({
    where: {
      id: input.roleId,
    },
    select: {
      id: true,
      name: true,
      permissions: {
        select: {
          permission: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!role) {
    throw new AppError("Role not found", 404);
  }

  const passwordHash = await hashPassword(input.password);

  try {
    // User and its role assignment must both succeed or neither should persist.
    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          employeeId: employee.id,
          email: input.email,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });

      return user;
    });

    // Same SafeUser shape the auth endpoints return, so a freshly provisioned
    // account can be rendered by the frontend without a second lookup.
    const safeUser: SafeUser = {
      id: createdUser.id,
      employeeId: employee.employeeId,
      email: createdUser.email,
      employee: {
        name: employee.name,
        designation: {
          id: employee.designation.id,
          name: employee.designation.name,
        },
      },
      roles: [role.name],
      permissions: role.permissions
        .map((rolePermission) => rolePermission.permission.name)
        .sort(),
    };

    return safeUser;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("Email already in use", 409);
    }

    throw error;
  }
}
