import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import {
  createAndSendNotification,
  findApproversForFarm,
} from "./notification.service.js";

interface QueuedAuditItem {
  attendanceId: string;
  farmId: string;
  farmName?: string;
  employeeName?: string;
  timestamp: number;
}

// In-memory debounce queue: Map<farmId, { items: QueuedAuditItem[]; timer: NodeJS.Timeout }>
const pendingFarmQueues = new Map<
  string,
  {
    items: QueuedAuditItem[];
    timer: NodeJS.Timeout;
  }
>();

const DEBOUNCE_DELAY_MS = 25_000; // 25 seconds debounce window

/**
 * Enqueue an IP fallback record for batched notification delivery.
 */
export function enqueueIpFallbackAudit(item: QueuedAuditItem): void {
  const existingQueue = pendingFarmQueues.get(item.farmId);

  if (existingQueue) {
    existingQueue.items.push(item);
    // Refresh or keep debounce timer running
    return;
  }

  // Create new farm batch
  const items = [item];
  const timer = setTimeout(() => {
    void flushFarmIpFallbackQueue(item.farmId);
  }, DEBOUNCE_DELAY_MS);

  pendingFarmQueues.set(item.farmId, { items, timer });
}

/**
 * Flush queue for a farm, compute dynamic backlog, and send a single consolidated push alert.
 */
async function flushFarmIpFallbackQueue(farmId: string): Promise<void> {
  const queueEntry = pendingFarmQueues.get(farmId);
  if (!queueEntry) return;

  pendingFarmQueues.delete(farmId);

  try {
    const newCount = queueEntry.items.length;
    if (newCount === 0) return;

    // 1. Fetch farm details
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: { name: true },
    });
    const farmName = farm?.name || "Farm";

    // 2. Compute dynamic unconfirmed backlog in database
    const totalPending = await prisma.attendance.count({
      where: {
        farmId,
        locationSource: { in: ["IP_FALLBACK", "FARM_DEFAULT"] },
        approvedAt: null,
      },
    });

    if (totalPending === 0) return;

    const backlogCount = Math.max(0, totalPending - newCount);

    // 3. Format consolidated message
    let bodyText = "";
    if (newCount === 1 && backlogCount === 0) {
      const empName = queueEntry.items[0]?.employeeName || "Employee";
      bodyText = `1 IP Fallback attendance record marked by ${empName} at ${farmName}. Confirmation required.`;
    } else if (newCount > 1 && backlogCount === 0) {
      bodyText = `${newCount} attendance records marked via IP Fallback at ${farmName}. Confirmation required.`;
    } else {
      bodyText = `${totalPending} attendance records require confirmation at ${farmName} (${newCount} new, ${backlogCount} pending backlog).`;
    }

    // 4. Find all eligible approvers for this farm
    const approverIds = await findApproversForFarm(farmId);

    const title = "⚠️ IP Fallback Attendance Audit";
    const linkUrl = `/attendance/approvals?source=IP_FALLBACK&farmId=${farmId}`;
    const tag = `farm-ip-fallback-${farmId}`;
    const metadata = {
      farmId,
      farmName,
      newCount,
      backlogCount,
      totalPending,
      remainingPending: totalPending,
      batchAttendanceIds: queueEntry.items.map((i) => i.attendanceId),
    };

    // 5. Build dispatch list: System Admin is always notified of all farm IP fallbacks in production,
    // plus any local farm-level approvers found.
    const dispatchPromises: Promise<void>[] = [
      createAndSendNotification({
        isSystemAdmin: true,
        category: "IP_FALLBACK_AUDIT",
        priority: "HIGH",
        title,
        body: bodyText,
        linkUrl,
        tag: `admin-ip-fallback-${farmId}`,
        metadata,
      }),
    ];

    for (const userId of approverIds) {
      dispatchPromises.push(
        createAndSendNotification({
          userId,
          category: "IP_FALLBACK_AUDIT",
          priority: "HIGH",
          title,
          body: bodyText,
          linkUrl,
          tag,
          metadata,
        }),
      );
    }

    await Promise.allSettled(dispatchPromises);

    logger.info(
      {
        farmId,
        newCount,
        backlogCount,
        totalPending,
        approverCount: approverIds.length,
        systemAdminNotified: true,
      },
      "Consolidated IP Fallback notification dispatched successfully",
    );
  } catch (error) {
    logger.error({ error, farmId }, "Error processing IP Fallback notification flush");
  }
}

/**
 * Automatically synchronize and resolve IP Fallback notifications when attendance records
 * on a farm are approved or audited.
 */
export async function syncIpFallbackAuditResolution(
  farmId: string,
  approverName?: string,
): Promise<void> {
  try {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: { name: true },
    });
    const farmName = farm?.name || "Farm";

    // Count remaining unapproved fallback records across ALL dates for this farm
    const remainingPending = await prisma.attendance.count({
      where: {
        farmId,
        locationSource: { in: ["IP_FALLBACK", "FARM_DEFAULT"] },
        approvedAt: null,
      },
    });

    // Find all IP_FALLBACK_AUDIT notifications for this farm
    const notifs = await prisma.notification.findMany({
      where: {
        category: "IP_FALLBACK_AUDIT",
        metadata: {
          path: ["farmId"],
          equals: farmId,
        },
      },
    });

    if (notifs.length === 0) return;

    const now = new Date();

    for (const n of notifs) {
      const meta =
        n.metadata && typeof n.metadata === "object"
          ? (n.metadata as Record<string, unknown>)
          : {};

      const batchIds = Array.isArray(meta.batchAttendanceIds)
        ? (meta.batchAttendanceIds as string[])
        : [];

      // Check if this specific notification's batch is resolved
      let isBatchResolved = false;
      let batchPendingCount = 0;

      if (batchIds.length > 0) {
        batchPendingCount = await prisma.attendance.count({
          where: {
            id: { in: batchIds },
            approvedAt: null,
          },
        });
        isBatchResolved = batchPendingCount === 0;
      } else {
        // Fallback for legacy notifications without batchAttendanceIds
        isBatchResolved = remainingPending === 0;
        batchPendingCount = remainingPending;
      }

      if (isBatchResolved || remainingPending === 0) {
        await prisma.notification.update({
          where: { id: n.id },
          data: {
            title: `[Resolved] ⚠️ IP Fallback Attendance Audit`,
            body: approverName
              ? `All IP Fallback records for this batch at ${farmName} have been audited and approved by ${approverName}.`
              : `All IP Fallback records for this batch at ${farmName} have been audited and approved.`,
            readAt: n.readAt || now,
            metadata: {
              ...meta,
              status: "RESOLVED",
              resolved: true,
              remainingPending: 0,
              totalPending: 0,
              resolvedAt: now.toISOString(),
              resolvedBy: approverName || "Approver",
            },
          },
        });
      } else {
        await prisma.notification.update({
          where: { id: n.id },
          data: {
            body: `${batchPendingCount} attendance record(s) require confirmation at ${farmName} (${approverName ? `updated by ${approverName}` : "partially audited"}).`,
            metadata: {
              ...meta,
              status: "PENDING",
              remainingPending: batchPendingCount,
              totalPending: remainingPending,
            },
          },
        });
      }
    }
    logger.info({ farmId, remainingPending }, "Synchronized IP Fallback notification audit statuses");
  } catch (error) {
    logger.error({ error, farmId }, "Error syncing IP fallback audit resolution");
  }
}
