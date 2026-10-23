import type { Request } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { isSystemAdminId } from "../auth/system-admin.js";


export interface RecordErrorOptions {
  err: unknown;
  req?: Request | undefined;
  statusCode?: number;
}

// Sanitize request body to remove sensitive fields
function sanitizePayload(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizePayload);

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("otp") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("authorization")
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (val && typeof val === "object") {
      sanitized[key] = sanitizePayload(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export async function recordSystemError({
  err,
  req,
  statusCode = 500,
}: RecordErrorOptions) {
  try {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const errorName = errorObj.name || "Error";
    const errCode = (err as { code?: string })?.code;
    const baseMessage = errorObj.message || "Unknown internal error";
    const errorMessage = errCode ? `[${errCode}] ${baseMessage}` : baseMessage;
    const stackTrace = errorObj.stack || null;

    const path = req?.originalUrl || req?.url || "unknown";
    const method = req?.method || "UNKNOWN";
    const requestId = (req as { id?: string })?.id || null;

    const ipAddress = req
      ? ((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          req.ip ||
          null)
      : null;
    const userAgent = req?.headers["user-agent"] || null;

    const queryParams = req?.query && Object.keys(req.query).length > 0
      ? JSON.parse(JSON.stringify(req.query))
      : null;

    const requestBody = req?.body
      ? (sanitizePayload(req.body) as Record<string, unknown>)
      : null;

    // Resolve Actor info (User, Role, Company, Farm)
    const rawUserId = (req as { userId?: string })?.userId || null;
    const isSysAdmin = rawUserId ? isSystemAdminId(rawUserId) : ((req as { isSystemAdmin?: boolean })?.isSystemAdmin === true);
    const userId = isSysAdmin ? null : rawUserId;
    let userName: string | null = isSysAdmin ? "System Administrator" : null;
    let userEmail: string | null = null;
    let userRole: string | null = isSysAdmin ? "SYSTEM_ADMIN" : null;
    let companyName: string | null = null;
    let farmName: string | null = null;

    if (userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            employee: {
              include: {
                farm: {
                  include: { company: true },
                },
              },
            },
            roles: {
              include: { role: true },
            },
          },
        });

        if (user) {
          userEmail = user.email;
          userName = user.employee?.name || null;
          companyName = user.employee?.farm?.company
            ? `${user.employee.farm.company.code} - ${user.employee.farm.company.name}`
            : null;
          farmName = user.employee?.farm
            ? `${user.employee.farm.code} - ${user.employee.farm.name}`
            : null;
          userRole = user.roles.map((r) => r.role.name).join(", ") || "User";
        }
      } catch (userErr) {
        logger.warn({ userErr }, "Could not resolve user context for error log");
      }
    }


    const errorLog = await prisma.systemErrorLog.create({
      data: {
        requestId,
        statusCode,
        errorName,
        errorMessage,
        stackTrace,
        method,
        path,
        queryParams: queryParams ? JSON.parse(JSON.stringify(queryParams)) : undefined,
        requestBody: requestBody ? JSON.parse(JSON.stringify(requestBody)) : undefined,
        userId,
        userName,
        userEmail,
        userRole,
        companyName,
        farmName,
        ipAddress,
        userAgent,
      },
    });

    return errorLog;
  } catch (logErr) {
    logger.error({ logErr }, "Failed to write system_error_log record");
    return null;
  }
}

export interface ListSystemErrorsQuery {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  errorName?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export async function listSystemErrors(query: ListSystemErrorsQuery) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (query.errorName) {
    where.errorName = query.errorName;
  }

  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { errorMessage: { contains: s, mode: "insensitive" } },
      { errorName: { contains: s, mode: "insensitive" } },
      { path: { contains: s, mode: "insensitive" } },
      { requestId: { contains: s, mode: "insensitive" } },
      { userName: { contains: s, mode: "insensitive" } },
      { userEmail: { contains: s, mode: "insensitive" } },
      { farmName: { contains: s, mode: "insensitive" } },
    ];
  }

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.systemErrorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.systemErrorLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getSystemErrorById(id: string) {
  return prisma.systemErrorLog.findUnique({
    where: { id },
  });
}

export async function markSystemErrorResolved(id: string, resolvedBy: string) {
  return prisma.systemErrorLog.update({
    where: { id },
    data: {
      resolvedAt: new Date(),
      resolvedBy,
    },
  });
}
