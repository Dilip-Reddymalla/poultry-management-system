import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useOnlineStatus } from "../pwa/useOnlineStatus.js";
import {
  countPendingAttendance,
  deletePendingAttendance,
  getPendingAttendance,
} from "../lib/offline-store.js";
import { syncAttendanceBatch } from "../api/resources.js";

interface OfflineQueueState {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  flush: () => Promise<void>;
  refreshCount: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueState | null>(null);

/** Reasons that mean the server already has the record (safe to drop). */
function isDupReason(reason?: string): boolean {
  return !!reason && /already recorded|duplicate|already exists/i.test(reason);
}

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      setPendingCount(await countPendingAttendance());
    } catch {
      // IndexedDB unavailable (private mode etc.) — treat as empty.
    }
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSyncing(true);
    try {
      const records = await getPendingAttendance();
      if (records.length === 0) return;

      // Flatten the whole queue into per-record items and submit them in ONE
      // request to the server's sync endpoint. The endpoint replays them through
      // the bulk services (sequential, scope-checked, deduplicated), so even a
      // large multi-device backlog is low-stress for the server.
      const items: Array<{
        itemId: string;
        kind: "single" | "face";
        data: Record<string, unknown>;
      }> = [];
      const owner = new Map<string, string[]>(); // itemId -> source localIds
      let counter = 0;

      for (const rec of records) {
        if (rec.kind === "single") {
          items.push({
            itemId: rec.localId,
            kind: "single",
            data: { ...rec.data, syncRef: rec.localId },
          });
          owner.set(rec.localId, [rec.localId]);
        } else {
          const inner =
            (rec.data as { records?: Array<Record<string, unknown>> }).records ??
            [];
          const ids = inner.map(() => `${rec.localId}-${counter++}`);
          inner.forEach((r, i) => {
            const id = ids[i]!;
            items.push({
              itemId: id,
              kind: rec.kind === "face-bulk" ? "face" : "single",
              data: { ...r, syncRef: id },
            });
            owner.set(id, [rec.localId]);
          });
        }
      }

      const response = await syncAttendanceBatch(items);

      // Keep a source record only if at least one of its items failed for a
      // non-duplicate reason (e.g. a validation error). Everything that reached
      // the server — or was already there — is dropped.
      const keepLocalIds = new Set<string>();
      for (const result of response.results) {
        const handled =
          result.status === "fulfilled" || isDupReason(result.reason);
        if (!handled) {
          for (const lid of owner.get(result.itemId) ?? []) {
            keepLocalIds.add(lid);
          }
        }
      }

      for (const rec of records) {
        if (!keepLocalIds.has(rec.localId)) {
          await deletePendingAttendance(rec.localId);
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
      await refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    if (online) {
      void flush();
    } else {
      void refreshCount();
    }
  }, [online, flush, refreshCount]);

  const value = useMemo(
    () => ({ online, pendingCount, syncing, flush, refreshCount }),
    [online, pendingCount, syncing, flush, refreshCount],
  );

  return (
    <OfflineQueueContext.Provider value={value}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue(): OfflineQueueState {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) {
    throw new Error("useOfflineQueue must be used within OfflineQueueProvider");
  }
  return ctx;
}
