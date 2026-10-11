import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { env } from "../../config/env.js";
import { webpush, isPushAvailable } from "./webpush.config.js";
import type { PushSubscriptionInput, NotificationQueryInput } from "./notification.schema.js";
import type { NotificationCategory, NotificationPriority } from "@prisma/client";

interface SendPushOptions {
  userId?: string;
  isSystemAdmin?: boolean;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  body: string;
  linkUrl?: string;
  tag?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 1. Subscription Management
// ---------------------------------------------------------------------------

export interface UserNotificationContext {
  userId?: string | undefined;
  isSystemAdmin?: boolean | undefined;
}

export async function savePushSubscription(
  options: UserNotificationContext,
  input: PushSubscriptionInput,
): Promise<{ success: boolean }> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent || null,
      userId: options.userId || null,
      systemAdmin: options.isSystemAdmin === true,
    },
    update: {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent || null,
      userId: options.userId || null,
      systemAdmin: options.isSystemAdmin === true,
      updatedAt: new Date(),
    },
  });

  return { success: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ success: boolean }> {
  try {
    await prisma.pushSubscription.delete({
      where: { endpoint },
    });
  } catch {
    // Already deleted or non-existent
  }
  return { success: true };
}

export function getVapidPublicKey(): string {
  return env.VAPID_PUBLIC_KEY || "";
}

// ---------------------------------------------------------------------------
// 2. Dispatch Push & In-App Notification (With Multi-Device & 410 Cleanup)
// ---------------------------------------------------------------------------

export async function createAndSendNotification(options: SendPushOptions): Promise<void> {
  // 1. Create In-App Notification Record
  try {
    await prisma.notification.create({
      data: {
        userId: options.userId || null,
        systemAdmin: options.isSystemAdmin === true,
        category: options.category,
        priority: options.priority || "MEDIUM",
        title: options.title,
        body: options.body,
        linkUrl: options.linkUrl || null,
        metadata: options.metadata ? JSON.parse(JSON.stringify(options.metadata)) : undefined,
      },
    });
  } catch (error) {
    logger.error({ error, options }, "Failed to create in-app notification record");
  }

  // 2. Query Active Device Push Subscriptions
  if (!isPushAvailable()) return;

  const whereCondition = options.isSystemAdmin
    ? { systemAdmin: true }
    : options.userId
      ? { userId: options.userId }
      : null;

  if (!whereCondition) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: whereCondition,
  });

  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title: options.title,
    body: options.body,
    url: options.linkUrl || "/notifications",
    tag: options.tag || `notification-${Date.now()}`,
    data: {
      category: options.category,
      metadata: options.metadata,
      linkUrl: options.linkUrl,
    },
  });

  // 3. Dispatch to all devices concurrently (phone, laptop, tablet)
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
          {
            TTL: 24 * 60 * 60, // 24 hours retention on push service
          },
        );
      } catch (err: unknown) {
        const error = err as { statusCode?: number };
        // Clean dead subscriptions independently (410 Gone / 404 Not Found)
        if (error?.statusCode === 410 || error?.statusCode === 404) {
          logger.info({ endpoint: sub.endpoint }, "Purging expired/unregistered push subscription");
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          logger.warn({ error: err, endpoint: sub.endpoint }, "Failed to deliver push notification");
        }
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// 3. In-App Notifications API Queries
// ---------------------------------------------------------------------------

export async function getUserNotifications(
  user: UserNotificationContext,
  query: NotificationQueryInput,
) {
  const where: Record<string, unknown> = {};

  if (user.isSystemAdmin) {
    where.systemAdmin = true;
  } else if (user.userId) {
    where.userId = user.userId;
  } else {
    return { data: [], total: 0, unreadCount: 0, page: 1, limit: query.limit };
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.unreadOnly) {
    where.readAt = null;
  }

  const unreadWhere = user.isSystemAdmin
    ? { systemAdmin: true, readAt: null }
    : { userId: user.userId!, readAt: null };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: unreadWhere }),
  ]);

  return {
    data: notifications,
    total,
    unreadCount,
    page: query.page,
    limit: query.limit,
  };
}

export async function markNotificationAsRead(
  notificationId: string,
  user: UserNotificationContext,
): Promise<{ success: boolean }> {
  const where = user.isSystemAdmin
    ? { id: notificationId, systemAdmin: true }
    : { id: notificationId, userId: user.userId! };

  await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return { success: true };
}

export async function markAllNotificationsAsRead(
  user: UserNotificationContext,
): Promise<{ count: number }> {
  const where = user.isSystemAdmin
    ? { systemAdmin: true, readAt: null }
    : { userId: user.userId!, readAt: null };

  const result = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return { count: result.count };
}

// ---------------------------------------------------------------------------
// 4. Resolve Eligible Approvers (Based on DB Permissions Matrix)
// ---------------------------------------------------------------------------

export async function findApproversForFarm(farmId: string): Promise<string[]> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { companyId: true },
  });

  if (!farm) return [];

  // Query users that possess 'attendance:approve' permission and match scope
  const approverUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      employee: {
        status: "ACTIVE",
      },
      roles: {
        some: {
          role: {
            permissions: {
              some: {
                permission: {
                  name: "attendance:approve",
                },
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      roles: {
        select: {
          role: {
            select: {
              scopeLevel: true,
            },
          },
        },
      },
      employee: {
        select: {
          farmId: true,
          farm: { select: { companyId: true } },
        },
      },
    },
  });

  // Filter based on scope level:
  // - FARM: must belong to the same farm
  // - COMPANY: must belong to the same company
  // - GLOBAL: matches all
  const eligibleUserIds = approverUsers
    .filter((user) => {
      return user.roles.some((ur) => {
        const level = ur.role.scopeLevel;
        if (level === "GLOBAL") return true;
        if (level === "COMPANY" && user.employee.farm.companyId === farm.companyId) return true;
        if (level === "FARM" && user.employee.farmId === farmId) return true;
        return false;
      });
    })
    .map((u) => u.id);

  return eligibleUserIds;
}
