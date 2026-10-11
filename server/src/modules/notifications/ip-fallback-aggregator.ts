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
        locationSource: "IP_FALLBACK",
        approvedAt: null,
      },
    });

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

    if (approverIds.length === 0) {
      logger.info({ farmId }, "No active approvers found for IP fallback notification");
      return;
    }

    const title = "⚠️ IP Fallback Attendance Audit";
    const linkUrl = `/attendance/approvals?filter=IP_FALLBACK&farmId=${farmId}`;
    const tag = `farm-ip-fallback-${farmId}`;

    // 5. Send single consolidated notification to each approver
    await Promise.allSettled(
      approverIds.map((userId) =>
        createAndSendNotification({
          userId,
          category: "IP_FALLBACK_AUDIT",
          priority: "HIGH",
          title,
          body: bodyText,
          linkUrl,
          tag,
          metadata: {
            farmId,
            farmName,
            newCount,
            backlogCount,
            totalPending,
            batchAttendanceIds: queueEntry.items.map((i) => i.attendanceId),
          },
        }),
      ),
    );

    logger.info(
      { farmId, newCount, backlogCount, totalPending, approverCount: approverIds.length },
      "Consolidated IP Fallback notification dispatched successfully",
    );
  } catch (error) {
    logger.error({ error, farmId }, "Error processing IP Fallback notification flush");
  }
}
