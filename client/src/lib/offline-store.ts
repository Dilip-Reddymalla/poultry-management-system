/**
 * Offline store — small IndexedDB-backed queue for attendance records created
 * while the device is offline. Records are held locally and replayed by the
 * sync engine once connectivity returns.
 *
 * We use IndexedDB (not `localStorage`) because queue entries can be large and
 * must survive page reloads; IndexedDB is the correct, non-blocking primitive.
 */

export interface PendingAttendanceRecord {
  /** Client-generated unique id for this queued record. */
  localId: string;
  /** What kind of payload this is, so the sync engine replays it correctly. */
  kind: "single" | "bulk" | "face-bulk";
  /** The raw attendance create payload captured at queue time. */
  data: Record<string, unknown>;
  createdAt: number;
}

const DB_NAME = "poultry-offline";
const DB_VERSION = 2;
const STORE = "pending-attendance";
/** Hard cap on queued offline records to avoid unbounded growth. */
const MAX_QUEUE = 500;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const request = fn(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

/** Queue an attendance payload locally; returns the local id. */
export async function enqueueAttendance(
  payload: Record<string, unknown>,
  kind: PendingAttendanceRecord["kind"] = "single",
): Promise<string> {
  const existing = await countPendingAttendance();
  if (existing >= MAX_QUEUE) {
    throw new Error(
      `Offline queue is full (${MAX_QUEUE} records). Go online to sync before adding more.`,
    );
  }
  const localId = `offline-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const record: PendingAttendanceRecord = {
    localId,
    kind,
    data: payload,
    createdAt: Date.now(),
  };
  await withStore((store) => store.add(record));
  return localId;
}

/** List every queued attendance record (oldest first). */
export async function getPendingAttendance(): Promise<PendingAttendanceRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all = (req.result as PendingAttendanceRecord[]) ?? [];
      all.sort((a, b) => a.createdAt - b.createdAt);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Remove a synced record from the queue. */
export async function deletePendingAttendance(localId: string): Promise<void> {
  await withStore((store) => store.delete(localId));
}

/** Number of records waiting to sync. */
export async function countPendingAttendance(): Promise<number> {
  const records = await getPendingAttendance();
  return records.length;
}
