import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { normalizePhone } from "../../utils/phone.js";
import type { AuthScope } from "../auth/scope.js";
import {
  assertFarmWritable,
  broadestScopeLevel,
  farmScopedWhere,
  isFarmInScope,
} from "../auth/scope.js";

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
// The farm is included so the frontend can show scope and the backend can
// authorize by the employee's farm/company.
const employeeSelect = {
  id: true,
  employeeId: true,
  name: true,
  phone: true,
  photoUrl: true,
  joiningDate: true,
  status: true,
  farm: {
    select: {
      id: true,
      code: true,
      name: true,
      companyId: true,
    },
  },
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
    farm: {
      id: employee.farm.id,
      code: employee.farm.code,
      name: employee.farm.name,
    },
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

// The target farm must exist and be writable by the caller (403 otherwise). Used
// by create and by every employee mutation to keep employees farm-scoped.
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

// A read that must not leak existence: an out-of-scope employee is reported as
// not found rather than forbidden.
async function loadReadableEmployee(
  scope: AuthScope,
  id: string,
): Promise<EmployeeRecord> {
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: employeeSelect,
  });

  if (
    !employee ||
    !isFarmInScope(scope, { companyId: employee.farm.companyId, id: employee.farm.id })
  ) {
    throw new AppError("Employee not found", 404);
  }

  return employee;
}

export async function listEmployees(
  scope: AuthScope,
  query: ListEmployeesQueryInput,
): Promise<{ employees: SafeEmployee[]; pagination: EmployeePagination }> {
  const where: Prisma.EmployeeWhereInput = {
    // Scope is enforced in the query, never in the frontend.
    ...farmScopedWhere(scope),
    ...(query.farmId !== undefined && { farmId: query.farmId }),
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

export async function getEmployeeById(
  scope: AuthScope,
  id: string,
): Promise<SafeEmployee> {
  return toSafeEmployee(await loadReadableEmployee(scope, id));
}

export async function createEmployee(
  scope: AuthScope,
  input: CreateEmployeeInput,
): Promise<SafeEmployee> {
  await assertFarmWritableById(scope, input.farmId);

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
        farmId: input.farmId,
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

    const safeEmp = toSafeEmployee(employee);
    void recordAuditLog({
      scope,
      action: "CREATE",
      entity: "Employee",
      entityId: employee.id,
      summary: `Created employee ${employee.name} (${employee.employeeId})`,
      changes: { employeeId: employee.employeeId, name: employee.name, farmId: employee.farm.id },
    });
    return safeEmp;
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function updateEmployee(
  scope: AuthScope,
  id: string,
  input: UpdateEmployeeInput,
): Promise<SafeEmployee> {
  const existingEmployee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      farm: { select: { id: true, companyId: true } },
    },
  });

  if (!existingEmployee) {
    throw new AppError("Employee not found", 404);
  }

  // Mutating an out-of-scope employee is forbidden, not hidden.
  assertFarmWritable(scope, {
    companyId: existingEmployee.farm.companyId,
    id: existingEmployee.farm.id,
  });

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

    const safeEmp = toSafeEmployee(employee);
    void recordAuditLog({
      scope,
      action: "UPDATE",
      entity: "Employee",
      entityId: employee.id,
      summary: `Updated employee ${employee.name} (${employee.employeeId})`,
      changes: input as Record<string, any>,
    });
    return safeEmp;
  } catch (error) {
    throw toWriteError(error);
  }
}

async function setEmployeeStatus(
  scope: AuthScope,
  id: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<SafeEmployee> {
  const existingEmployee = await prisma.employee.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      status: true,
      farm: { select: { id: true, companyId: true } },
    },
  });

  if (!existingEmployee) {
    throw new AppError("Employee not found", 404);
  }

  assertFarmWritable(scope, {
    companyId: existingEmployee.farm.companyId,
    id: existingEmployee.farm.id,
  });

  if (existingEmployee.status === status) {
    throw new AppError(
      status === "INACTIVE"
        ? "Employee is already inactive"
        : "Employee is already active",
      409,
    );
  }

  const employee = await prisma.employee.update({
    where: {
      id,
    },
    data: {
      status,
    },
    select: employeeSelect,
  });

  const safeEmp = toSafeEmployee(employee);
  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "Employee",
    entityId: employee.id,
    summary: `${status === "ACTIVE" ? "Reactivated" : "Deactivated"} employee ${employee.name} (${employee.employeeId})`,
    changes: { oldStatus: existingEmployee.status, newStatus: status },
  });
  return safeEmp;
}

export async function deactivateEmployee(
  scope: AuthScope,
  id: string,
): Promise<SafeEmployee> {
  return setEmployeeStatus(scope, id, "INACTIVE");
}

export async function reactivateEmployee(
  scope: AuthScope,
  id: string,
): Promise<SafeEmployee> {
  return setEmployeeStatus(scope, id, "ACTIVE");
}

// Selects only non-sensitive fields needed to build a SafeUser response; the
// passwordHash is never read back (and is null for a freshly provisioned user).
const provisionEmployeeSelect = {
  id: true,
  employeeId: true,
  name: true,
  status: true,
  phone: true,
  farmId: true,
  farm: {
    select: {
      id: true,
      companyId: true,
    },
  },
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

// Passwordless provisioning: the account is created with no password and a
// mustSetPassword flag. The employee signs in first by phone OTP, then sets a
// password (see auth.setPassword). A phone number is required because it is the
// first-login channel.
export async function provisionEmployeeUser(
  scope: AuthScope,
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

  assertFarmWritable(scope, {
    companyId: employee.farm.companyId,
    id: employee.farm.id,
  });

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      "Cannot provision a login for an inactive employee",
      409,
    );
  }

  if (employee.user !== null) {
    throw new AppError("Employee already has a user account", 409);
  }

  if (!employee.phone) {
    throw new AppError(
      "Employee needs a phone number before a login can be provisioned",
      409,
    );
  }

  const role = await prisma.role.findUnique({
    where: {
      id: input.roleId,
    },
    select: {
      id: true,
      name: true,
      scopeLevel: true,
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

  try {
    // User and its role assignment must both succeed or neither should persist.
    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          employeeId: employee.id,
          email: input.email,
          passwordHash: null,
          mustSetPassword: true,
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
    // account can be rendered by the frontend without a second lookup. It is
    // flagged mustSetPassword: the login is not usable until setup completes.
    const safeUser: SafeUser = {
      id: createdUser.id,
      employeeId: employee.employeeId,
      email: createdUser.email,
      isSystemAdmin: false,
      mustSetPassword: true,
      scope: {
        level: broadestScopeLevel([role.scopeLevel]),
        companyId: employee.farm.companyId,
        farmId: employee.farmId,
      },
      employee: {
        id: employee.id,
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

    void recordAuditLog({
      scope,
      action: "CREATE",
      entity: "User",
      entityId: createdUser.id,
      summary: `Provisioned user account for employee ${employee.name} (${employee.employeeId}) with email ${createdUser.email}`,
      changes: { email: createdUser.email, roleId: role.id, roleName: role.name },
    });

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
