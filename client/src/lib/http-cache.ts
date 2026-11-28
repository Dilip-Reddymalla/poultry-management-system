/**
 * Minimal IndexedDB cache for successful GET responses. Used by the API client
 * so the app can render previously-viewed data while offline. It is best-effort:
 * if IndexedDB is unavailable (e.g. private mode) every call degrades to a no-op.
 */

const DB_NAME = "poultry-offline";
const DB_VERSION = 2;
const STORE = "http-cache";
const MAX_ENTRIES = 200;

interface CachedEntry {
  url: string;
  data: unknown;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "url" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function evictIfNeeded(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count <= MAX_ENTRIES) {
        resolve();
        return;
      }
      const excess = count - MAX_ENTRIES;
      let deleted = 0;
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && deleted < excess) {
          cursor.delete();
          deleted += 1;
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => resolve();
    };
    countReq.onerror = () => resolve();
  });
}

export async function cachePut(url: string, data: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const entry: CachedEntry = { url, data, savedAt: Date.now() };
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    await evictIfNeeded(db);
  } catch {
    // ignore
  } finally {
    db.close();
  }
}

export async function cacheGet(url: string): Promise<unknown | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  try {
    return await new Promise<unknown | undefined>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(url);
      req.onsuccess = () => {
        const entry = req.result as CachedEntry | undefined;
        resolve(entry ? entry.data : undefined);
      };
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  } finally {
    db.close();
  }
}

/**
 * Wipe the entire offline GET cache. Called on sign-out and when a session
 * expires so cached data from one user can never leak to the next user on a
 * shared device.
 */
export async function cacheClear(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  } finally {
    db.close();
  }
}
