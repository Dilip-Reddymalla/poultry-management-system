import type { AuditAction } from "@prisma/client";

export interface SafeAuditLog {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  summary: string;
  changes: Record<string, any> | null;
  actorId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRoles: string[] | null;
  companyName: string | null;
  farmName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogListQuery {
  page?: number;
  limit?: number;
  entity?: string;
  action?: AuditAction;
  search?: string;
  from?: Date;
  to?: Date;
}

export interface AuditLogListResponse {
  logs: SafeAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
