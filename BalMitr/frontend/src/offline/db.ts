import { Centre, Child } from "../types";

export type SyncStatus = "waiting" | "synced" | "failed";

export interface SyncQueueItem {
  client_uuid: string;
  type: "child" | "measurement";
  payload: Record<string, unknown>;
  sync_status: SyncStatus;
  error_message?: string;
  created_at: string;
  server_id?: number;
}

const DB_NAME = "balmitr_offline_v1";
const DB_VERSION = 1;

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function syncBadgeInfo(status: SyncStatus): { label: string; className: string } {
  if (status === "synced") return { label: "Synced", className: "chip chip-mint" };
  if (status === "failed") return { label: "Failed", className: "chip chip-red" };
  return { label: "Waiting to sync", className: "chip chip-amber" };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", { keyPath: "client_uuid" });
      }
      if (!db.objectStoreNames.contains("cached_children")) {
        db.createObjectStore("cached_children", { keyPath: "client_uuid" });
      }
      if (!db.objectStoreNames.contains("cached_centres")) {
        db.createObjectStore("cached_centres", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueSyncItem(
  type: "child" | "measurement",
  payload: Record<string, unknown>,
  clientUuid?: string
): Promise<SyncQueueItem> {
  const db = await openDb();
  const item: SyncQueueItem = {
    client_uuid: clientUuid || generateUuid(),
    type,
    payload,
    sync_status: "waiting",
    created_at: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    tx.objectStore("sync_queue").put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return item;
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDb();
  const items = await new Promise<SyncQueueItem[]>((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readonly");
    const req = tx.objectStore("sync_queue").getAll();
    req.onsuccess = () => resolve((req.result as SyncQueueItem[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function updateSyncItem(
  clientUuid: string,
  patch: Partial<SyncQueueItem>
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const getReq = store.get(clientUuid);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, ...patch });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearSyncedItems(): Promise<void> {
  const db = await openDb();
  const items = await getSyncQueue();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    for (const item of items) {
      if (item.sync_status === "synced") {
        store.delete(item.client_uuid);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function saveCachedChildren(children: Child[]): Promise<void> {
  const db = await openDb();
  const queue = await getSyncQueue();
  const pendingChildUuids = new Set(
    queue.filter((q) => q.type === "child" && q.sync_status !== "synced").map((q) => q.client_uuid)
  );
  const existing = await new Promise<Child[]>((resolve) => {
    const tx = db.transaction("cached_children", "readonly");
    const req = tx.objectStore("cached_children").getAll();
    req.onsuccess = () => resolve((req.result as Child[]) || []);
    req.onerror = () => resolve([]);
  });

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cached_children", "readwrite");
    const store = tx.objectStore("cached_children");
    store.clear();
    for (const c of children) {
      store.put(c);
    }
    for (const c of existing) {
      if (pendingChildUuids.has(c.client_uuid) && !children.some((s) => s.client_uuid === c.client_uuid)) {
        store.put(c);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function upsertCachedChild(child: Child): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cached_children", "readwrite");
    tx.objectStore("cached_children").put(child);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedChildren(): Promise<Child[]> {
  const db = await openDb();
  const items = await new Promise<Child[]>((resolve) => {
    const tx = db.transaction("cached_children", "readonly");
    const req = tx.objectStore("cached_children").getAll();
    req.onsuccess = () => resolve((req.result as Child[]) || []);
    req.onerror = () => resolve([]);
  });
  db.close();
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCachedCentres(centres: Centre[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cached_centres", "readwrite");
    const store = tx.objectStore("cached_centres");
    store.clear();
    for (const c of centres) store.put(c);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedCentres(): Promise<Centre[]> {
  const db = await openDb();
  const items = await new Promise<Centre[]>((resolve) => {
    const tx = db.transaction("cached_centres", "readonly");
    const req = tx.objectStore("cached_centres").getAll();
    req.onsuccess = () => resolve((req.result as Centre[]) || []);
    req.onerror = () => resolve([]);
  });
  db.close();
  return items;
}
