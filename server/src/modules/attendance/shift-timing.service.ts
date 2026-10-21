import type { Shift } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit/audit.service.js";
import type { AuthScope } from "../auth/scope.js";
import { assertFarmWritable, assertCompanyWritable } from "../auth/scope.js";
import {
  getEffectiveShiftTimings,
  invalidateShiftTimingCache,
  type ShiftTimingRule,
} from "./shift-timing.js";

export interface UpdateShiftTimingInput {
  label?: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  crossesMidnight?: boolean;
  isEnabled?: boolean;
}

export async function getFarmShiftSchedule(
  scope: AuthScope,
  farmId: string,
): Promise<{ farmId: string; shifts: ShiftTimingRule[] }> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true },
  });
  if (!farm) throw new AppError("Farm not found", 404);

  const effective = await getEffectiveShiftTimings(farm.id, farm.companyId);
  return {
    farmId: farm.id,
    shifts: Object.values(effective),
  };
}

export async function updateFarmShiftTiming(
  scope: AuthScope,
  farmId: string,
  shift: Shift,
  input: UpdateShiftTimingInput,
): Promise<ShiftTimingRule> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true, name: true },
  });
  if (!farm) throw new AppError("Farm not found", 404);

  assertFarmWritable(scope, { id: farm.id, companyId: farm.companyId });

  if (input.startHour < 0 || input.startHour > 24 || input.endHour < 0 || input.endHour > 24) {
    throw new AppError("Invalid hours: must be between 0 and 24", 400);
  }
  if (input.startMinute < 0 || input.startMinute > 59 || input.endMinute < 0 || input.endMinute > 59) {
    throw new AppError("Invalid minutes: must be between 0 and 59", 400);
  }

  const crossesMidnight =
    input.crossesMidnight ??
    (input.endHour < input.startHour || (input.endHour === input.startHour && input.endMinute < input.startMinute));

  const label = input.label?.trim() || `${shift.replace("_", " ")}`;

  await prisma.shiftTiming.upsert({
    where: {
      farmId_shift: { farmId, shift },
    },
    update: {
      label,
      startHour: input.startHour,
      startMinute: input.startMinute,
      endHour: input.endHour,
      endMinute: input.endMinute,
      crossesMidnight,
      isEnabled: input.isEnabled ?? true,
    },
    create: {
      farmId,
      companyId: farm.companyId,
      shift,
      label,
      startHour: input.startHour,
      startMinute: input.startMinute,
      endHour: input.endHour,
      endMinute: input.endMinute,
      crossesMidnight,
      isEnabled: input.isEnabled ?? true,
    },
  });

  invalidateShiftTimingCache(farmId, farm.companyId);

  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "ShiftTiming",
    entityId: `${farmId}:${shift}`,
    summary: `Updated shift ${shift} timing on farm ${farm.name}`,
    changes: { shift, ...input, crossesMidnight },
  });

  const effective = await getEffectiveShiftTimings(farmId, farm.companyId);
  return effective[shift];
}

export async function resetFarmShiftTiming(
  scope: AuthScope,
  farmId: string,
  shift: Shift,
): Promise<ShiftTimingRule> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, companyId: true, name: true },
  });
  if (!farm) throw new AppError("Farm not found", 404);

  assertFarmWritable(scope, { id: farm.id, companyId: farm.companyId });

  await prisma.shiftTiming.deleteMany({
    where: { farmId, shift },
  });

  invalidateShiftTimingCache(farmId, farm.companyId);

  void recordAuditLog({
    scope,
    action: "DELETE",
    entity: "ShiftTiming",
    entityId: `${farmId}:${shift}`,
    summary: `Reset shift ${shift} timing on farm ${farm.name} to company/system default`,
  });

  const effective = await getEffectiveShiftTimings(farmId, farm.companyId);
  return effective[shift];
}

export async function getCompanyShiftSchedule(
  scope: AuthScope,
  companyId: string,
): Promise<{ companyId: string; shifts: ShiftTimingRule[] }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw new AppError("Company not found", 404);

  const effective = await getEffectiveShiftTimings(null, company.id);
  return {
    companyId: company.id,
    shifts: Object.values(effective),
  };
}

export async function updateCompanyShiftTiming(
  scope: AuthScope,
  companyId: string,
  shift: Shift,
  input: UpdateShiftTimingInput,
): Promise<ShiftTimingRule> {
  assertCompanyWritable(scope, companyId);

  if (input.startHour < 0 || input.startHour > 24 || input.endHour < 0 || input.endHour > 24) {
    throw new AppError("Invalid hours: must be between 0 and 24", 400);
  }
  if (input.startMinute < 0 || input.startMinute > 59 || input.endMinute < 0 || input.endMinute > 59) {
    throw new AppError("Invalid minutes: must be between 0 and 59", 400);
  }

  const crossesMidnight =
    input.crossesMidnight ??
    (input.endHour < input.startHour || (input.endHour === input.startHour && input.endMinute < input.startMinute));

  const label = input.label?.trim() || `${shift.replace("_", " ")}`;

  // Find existing company-wide timing for this shift
  const existing = await prisma.shiftTiming.findFirst({
    where: { companyId, farmId: null, shift },
  });

  if (existing) {
    await prisma.shiftTiming.update({
      where: { id: existing.id },
      data: {
        label,
        startHour: input.startHour,
        startMinute: input.startMinute,
        endHour: input.endHour,
        endMinute: input.endMinute,
        crossesMidnight,
        isEnabled: input.isEnabled ?? true,
      },
    });
  } else {
    await prisma.shiftTiming.create({
      data: {
        companyId,
        shift,
        label,
        startHour: input.startHour,
        startMinute: input.startMinute,
        endHour: input.endHour,
        endMinute: input.endMinute,
        crossesMidnight,
        isEnabled: input.isEnabled ?? true,
      },
    });
  }

  invalidateShiftTimingCache(undefined, companyId);

  void recordAuditLog({
    scope,
    action: "UPDATE",
    entity: "ShiftTiming",
    entityId: `${companyId}:${shift}`,
    summary: `Updated company-wide default for shift ${shift}`,
    changes: { shift, ...input, crossesMidnight },
  });

  const effective = await getEffectiveShiftTimings(null, companyId);
  return effective[shift];
}
