import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { useAuth } from "./AuthContext";
import {
  clearSyncedItems,
  enqueueSyncItem,
  generateUuid,
  getSyncQueue,
  SyncQueueItem,
  updateSyncItem,
  upsertCachedChild,
} from "../offline/db";
import { Child } from "../types";
import { ageInMonths, formatAge } from "../utils/age";

interface SyncResultItem {
  client_uuid: string;
  status: "synced" | "already_synced" | "failed";
  server_id?: number;
  data?: unknown;
  error?: unknown;
}

interface SyncCtx {
  queue: SyncQueueItem[];
  waitingCount: number;
  syncing: boolean;
  syncVersion: number;
  isOnline: boolean;
  simulateOffline: boolean;
  setSimulateOffline: (v: boolean) => void;
  lastSyncMessage: string | null;
  refreshQueue: () => Promise<void>;
  syncNow: () => Promise<void>;
  clearSynced: () => Promise<void>;
  queueChild: (payload: {
    name: string;
    sex: "M" | "F";
    date_of_birth: string;
    guardian_name: string;
    centre: number;
    centre_name: string;
  }) => Promise<{ queuedOffline: boolean; client_uuid: string; serverId?: number }>;
  queueMeasurement: (payload: {
    child?: number;
    child_client_uuid?: string;
    date: string;
    weight_kg: number;
    height_cm: number;
    measured_position: "lying" | "standing";
  }) => Promise<{ queuedOffline: boolean; client_uuid: string }>;
}

const SyncContext = createContext<SyncCtx | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [browserOnline, setBrowserOnline] = useState<boolean>(navigator.onLine);
  const [simulateOffline, setSimulateOfflineState] = useState<boolean>(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const isOnline = browserOnline && !simulateOffline;

  const refreshQueue = useCallback(async () => {
    const items = await getSyncQueue();
    setQueue(items);
  }, []);

  const syncNow = useCallback(async () => {
    if (!user || !isOnline) return;
    const items = await getSyncQueue();
    const pending = items.filter((i) => i.sync_status === "waiting" || i.sync_status === "failed");
    if (pending.length === 0) {
      setQueue(items);
      return;
    }
    setSyncing(true);
    try {
      const res = await apiFetch<{
        results: SyncResultItem[];
        summary: { synced: number; already_synced: number; failed: number };
      }>("/sync/", {
        method: "POST",
        body: JSON.stringify({
          items: pending.map((p) => ({
            client_uuid: p.client_uuid,
            type: p.type,
            payload: p.payload,
          })),
        }),
      });
      for (const r of res.results) {
        if (r.status === "synced" || r.status === "already_synced") {
          await updateSyncItem(r.client_uuid, {
            sync_status: "synced",
            server_id: r.server_id,
            error_message: undefined,
          });
        } else {
          await updateSyncItem(r.client_uuid, {
            sync_status: "failed",
            error_message: typeof r.error === "string" ? r.error : JSON.stringify(r.error),
          });
        }
      }
      setLastSyncMessage(
        `Synced ${res.summary.synced + res.summary.already_synced}, failed ${res.summary.failed}.`
      );
      await refreshQueue();
      setSyncVersion((v) => v + 1);
    } catch (e) {
      setLastSyncMessage(e instanceof Error ? e.message : "Sync could not reach server.");
    } finally {
      setSyncing(false);
    }
  }, [user, isOnline, refreshQueue]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      syncNow();
    }
  }, [isOnline, syncNow]);

  function setSimulateOffline(v: boolean) {
    setSimulateOfflineState(v);
  }

  async function queueChild(payload: {
    name: string;
    sex: "M" | "F";
    date_of_birth: string;
    guardian_name: string;
    centre: number;
    centre_name: string;
  }) {
    const cuuid = generateUuid();
    await enqueueSyncItem("child", {
      name: payload.name,
      sex: payload.sex,
      date_of_birth: payload.date_of_birth,
      guardian_name: payload.guardian_name,
      centre: payload.centre,
    }, cuuid);

    const months = ageInMonths(payload.date_of_birth);
    const localChild: Child = {
      id: -Math.floor(Date.now() % 1000000),
      client_uuid: cuuid,
      centre: payload.centre,
      centre_name: payload.centre_name,
      name: payload.name,
      sex: payload.sex,
      date_of_birth: payload.date_of_birth,
      guardian_name: payload.guardian_name,
      age_months: months,
      age_display: formatAge(months),
      latest: null,
      status_chips: [],
      created_at: new Date().toISOString(),
    };
    await upsertCachedChild(localChild);
    await refreshQueue();

    if (isOnline) {
      await syncNow();
      const updated = await getSyncQueue();
      const found = updated.find((i) => i.client_uuid === cuuid);
      if (found?.sync_status === "synced") {
        return { queuedOffline: false, client_uuid: cuuid, serverId: found.server_id };
      }
    }
    return { queuedOffline: true, client_uuid: cuuid };
  }

  async function queueMeasurement(payload: {
    child?: number;
    child_client_uuid?: string;
    date: string;
    weight_kg: number;
    height_cm: number;
    measured_position: "lying" | "standing";
  }) {
    const cuuid = generateUuid();
    await enqueueSyncItem("measurement", {
      ...(payload.child && payload.child > 0 ? { child: payload.child } : {}),
      ...(payload.child_client_uuid ? { child_client_uuid: payload.child_client_uuid } : {}),
      date: payload.date,
      weight_kg: payload.weight_kg,
      height_cm: payload.height_cm,
      measured_position: payload.measured_position,
    }, cuuid);
    await refreshQueue();

    if (isOnline) {
      await syncNow();
      const updated = await getSyncQueue();
      const found = updated.find((i) => i.client_uuid === cuuid);
      if (found?.sync_status === "synced") {
        return { queuedOffline: false, client_uuid: cuuid };
      }
    }
    return { queuedOffline: true, client_uuid: cuuid };
  }

  async function clearSynced() {
    await clearSyncedItems();
    await refreshQueue();
  }

  const waitingCount = queue.filter((q) => q.sync_status !== "synced").length;

  return (
    <SyncContext.Provider
      value={{
        queue,
        waitingCount,
        syncing,
        syncVersion,
        isOnline,
        simulateOffline,
        setSimulateOffline,
        lastSyncMessage,
        refreshQueue,
        syncNow,
        clearSynced,
        queueChild,
        queueMeasurement,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be inside SyncProvider");
  return ctx;
}
