import type { Request, Response } from "express";

import { getScope } from "../../middlewares/authorize.middleware.js";

import {
  createEmployee,
  deactivateEmployee,
  getEmployeeById,
  listEmployees,
  provisionEmployeeUser,
  reactivateEmployee,
  updateEmployee,
} from "./employee.service.js";
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  listEmployeesQuerySchema,
  provisionUserSchema,
  updateEmployeeSchema,
} from "./employee.schema.js";

export async function listEmployeesController(
  req: Request,
  res: Response,
): Promise<void> {
  const query = listEmployeesQuerySchema.parse(req.query);

  const { employees, pagination } = await listEmployees(getScope(req), query);

  res.status(200).json({
    success: true,
    employees,
    pagination,
  });
}

export async function getEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);

  const employee = await getEmployeeById(getScope(req), params.id);

  res.status(200).json({
    success: true,
    employee,
  });
}

export async function createEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createEmployeeSchema.parse(req.body);

  const employee = await createEmployee(getScope(req), input);

  res.status(201).json({
    success: true,
    message: "Employee created successfully",
    employee,
  });
}

export async function updateEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);

  const input = updateEmployeeSchema.parse(req.body);

  const employee = await updateEmployee(getScope(req), params.id, input);

  res.status(200).json({
    success: true,
    message: "Employee updated successfully",
    employee,
  });
}

export async function deactivateEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);

  const employee = await deactivateEmployee(getScope(req), params.id);

  res.status(200).json({
    success: true,
    message: "Employee deactivated successfully",
    employee,
  });
}

export async function reactivateEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);

  const employee = await reactivateEmployee(getScope(req), params.id);

  res.status(200).json({
    success: true,
    message: "Employee reactivated successfully",
    employee,
  });
}

export async function provisionEmployeeUserController(
  req: Request,
  res: Response,
): Promise<void> {
  const params = employeeIdParamSchema.parse(req.params);

  const input = provisionUserSchema.parse(req.body);

  const user = await provisionEmployeeUser(getScope(req), params.id, input);

  res.status(201).json({
    success: true,
    message: "User account created successfully",
    user,
  });
}
