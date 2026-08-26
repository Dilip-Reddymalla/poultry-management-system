import type { Response, Request } from "express";
import ExcelJS from "exceljs";
import { type AuditAction, Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import type { AuthScope } from "../auth/scope.js";
import type {
  ListAuditLogsQueryInput,
  ExportAuditLogsQueryInput,
} from "./audit.schema.js";
import type { SafeAuditLog, AuditLogListResponse } from "./audit.types.ts";

export interface RecordAuditParams {
  scope: AuthScope;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary: string;
  changes?: Record<string, any> | null;
  req?: Request;
}

export async function recordAuditLog({
  scope,
  action,
  entity,
  entityId,
  summary,
  changes,
  req,
}: RecordAuditParams): Promise<void> {
  try {
    let actorName = "System Administrator";
    let actorEmail: string | null = null;
    let companyName: string | null = null;
    let farmName: string | null = null;

    if (!scope.isSystemAdmin && scope.userId) {
      const user = await prisma.user.findUnique({
        where: { id: scope.userId },
        select: {
          email: true,
          employee: {
            select: {
              name: true,
              farm: {
                select: {
                  code: true,
                  name: true,
                  company: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      });

      if (user) {
        actorName = user.employee.name;
        actorEmail = user.email;
        companyName = `${user.employee.farm.company.code} — ${user.employee.farm.company.name}`;
        farmName = `${user.employee.farm.code} — ${user.employee.farm.name}`;
      }
    }

    const ipAddress = req
      ? (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null
      : null;
    const userAgent = req ? req.headers["user-agent"] || null : null;

    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId ?? null,
        summary,
        changes: changes ? (changes as Prisma.InputJsonValue) : Prisma.JsonNull,
        actorId: scope.userId,
        actorName,
        actorEmail,
        actorRoles: scope.roles as Prisma.InputJsonValue,
        companyName,
        farmName,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Non-blocking: log errors to console so business operations never fail due to audit logging
    console.error("Failed to write audit log:", error);
  }
}

export async function listAuditLogs(
  query: ListAuditLogsQueryInput,
): Promise<AuditLogListResponse> {
  const dateFilter =
    query.from !== undefined || query.to !== undefined
      ? {
          ...(query.from !== undefined && { gte: query.from }),
          ...(query.to !== undefined && { lte: query.to }),
        }
      : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(query.entity !== undefined && { entity: query.entity }),
    ...(query.action !== undefined && { action: query.action }),
    ...(dateFilter !== undefined && { createdAt: dateFilter }),
  };

  if (query.search) {
    where.OR = [
      { summary: { contains: query.search, mode: "insensitive" } },
      { actorName: { contains: query.search, mode: "insensitive" } },
      { actorEmail: { contains: query.search, mode: "insensitive" } },
      { entity: { contains: query.search, mode: "insensitive" } },
      { entityId: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [records, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const logs: SafeAuditLog[] = records.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    summary: r.summary,
    changes: r.changes as Record<string, any> | null,
    actorId: r.actorId,
    actorName: r.actorName,
    actorEmail: r.actorEmail,
    actorRoles: r.actorRoles as string[] | null,
    companyName: r.companyName,
    farmName: r.farmName,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    createdAt: r.createdAt,
  }));

  return {
    logs,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function exportAuditLogs(
  query: ExportAuditLogsQueryInput,
  res: Response,
): Promise<void> {
  const dateFilter =
    query.from !== undefined || query.to !== undefined
      ? {
          ...(query.from !== undefined && { gte: query.from }),
          ...(query.to !== undefined && { lte: query.to }),
        }
      : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(query.entity !== undefined && { entity: query.entity }),
    ...(query.action !== undefined && { action: query.action }),
    ...(dateFilter !== undefined && { createdAt: dateFilter }),
  };

  if (query.search) {
    where.OR = [
      { summary: { contains: query.search, mode: "insensitive" } },
      { actorName: { contains: query.search, mode: "insensitive" } },
      { actorEmail: { contains: query.search, mode: "insensitive" } },
      { entity: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const records = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Poultry Management System - System Admin Audit";

  const sheet = workbook.addWorksheet("Audit Logs");

  sheet.columns = [
    { header: "Timestamp", key: "createdAt", width: 22 },
    { header: "Action", key: "action", width: 12 },
    { header: "Entity", key: "entity", width: 15 },
    { header: "Entity ID", key: "entityId", width: 36 },
    { header: "Actor Name", key: "actorName", width: 25 },
    { header: "Actor Email", key: "actorEmail", width: 25 },
    { header: "Roles", key: "actorRoles", width: 25 },
    { header: "Company", key: "companyName", width: 20 },
    { header: "Farm", key: "farmName", width: 20 },
    { header: "Summary", key: "summary", width: 45 },
    { header: "Changes (JSON)", key: "changes", width: 40 },
    { header: "IP Address", key: "ipAddress", width: 18 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  for (const record of records) {
    sheet.addRow({
      createdAt: record.createdAt.toISOString().replace("T", " ").slice(0, 19),
      action: record.action,
      entity: record.entity,
      entityId: record.entityId ?? "—",
      actorName: record.actorName,
      actorEmail: record.actorEmail ?? "—",
      actorRoles: Array.isArray(record.actorRoles) ? (record.actorRoles as string[]).join(", ") : "SYSTEM_ADMIN",
      companyName: record.companyName ?? "Global",
      farmName: record.farmName ?? "Global",
      summary: record.summary,
      changes: record.changes ? JSON.stringify(record.changes) : "None",
      ipAddress: record.ipAddress ?? "—",
    });
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="System_Audit_Log_${new Date().toISOString().slice(0, 10)}.xlsx"`,
  );

  await workbook.xlsx.write(res);
  res.end();
}
