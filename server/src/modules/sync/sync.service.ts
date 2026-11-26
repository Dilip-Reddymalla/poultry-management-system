import { bulkCreateAttendance } from "../attendance/attendance.service.js";
import { bulkMarkFaceAttendance } from "../attendance/face-attendance.service.js";
import type { AuthScope } from "../auth/scope.js";
import type { SyncAttendanceInput } from "./sync.schema.js";

export interface SyncItemResult {
  itemId: string;
  status: "fulfilled" | "rejected";
  reason?: string;
}

/**
 * Systematic, server-side ingestion of offline attendance updates coming from
 * any number of devices.
 *
 * Items are grouped by kind and replayed through the *existing* bulk services
 * (which already run sequentially, validate per-record scope, and deduplicate on
 * the unique date/shift/person constraint). Because a whole device queue is
 * processed in one request with bounded, sequential work, this keeps server load
 * low even when many devices reconnect at once.
 *
 * Returns one result per item so the client can drop exactly what succeeded and
 * keep (retry) only what genuinely failed.
 */
export async function syncAttendance(
  scope: AuthScope,
  input: SyncAttendanceInput,
): Promise<{ results: SyncItemResult[] }> {
  const singleItems = input.items.filter((i) => i.kind === "single");
  const faceItems = input.items.filter((i) => i.kind === "face");
  const results = new Map<string, SyncItemResult>();

  if (singleItems.length > 0) {
    const outcome = await bulkCreateAttendance(scope, {
      records: singleItems.map((i) => i.data as never),
    });

    singleItems.forEach((item, idx) => {
      const r = outcome[idx];
      results.set(
        item.itemId,
        r?.status === "fulfilled"
          ? { itemId: item.itemId, status: "fulfilled" }
          : {
              itemId: item.itemId,
              status: "rejected",
              reason: r?.reason || "Unknown error",
            },
      );
    });
  }

  if (faceItems.length > 0) {
    const outcome = await bulkMarkFaceAttendance(scope, {
      records: faceItems.map((i) => i.data as never),
    });

    // Indices absent from `errors` are either successfully marked or duplicate
    // (both mean the server now holds the record → treat as fulfilled).
    const errorByIndex = new Map<number, string>(
      outcome.errors.map((e) => [e.index, e.reason]),
    );

    faceItems.forEach((item, idx) => {
      const reason = errorByIndex.get(idx);
      results.set(
        item.itemId,
        reason !== undefined
          ? { itemId: item.itemId, status: "rejected", reason }
          : { itemId: item.itemId, status: "fulfilled" },
      );
    });
  }

  return { results: Array.from(results.values()) };
}
