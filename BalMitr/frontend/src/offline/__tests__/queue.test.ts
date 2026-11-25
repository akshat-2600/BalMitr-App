import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  clearSyncedItems,
  enqueueSyncItem,
  getSyncQueue,
  syncBadgeInfo,
  updateSyncItem,
} from "../db";

describe("offline IndexedDB sync queue and badges", () => {
  it("stores waiting items, updates to synced or failed, and returns badge labels", async () => {
    const item = await enqueueSyncItem("child", { name: "Offline Child" });
    expect(item.sync_status).toBe("waiting");
    expect(syncBadgeInfo(item.sync_status).label).toBe("Waiting to sync");

    let all = await getSyncQueue();
    expect(all.some((q) => q.client_uuid === item.client_uuid)).toBe(true);

    await updateSyncItem(item.client_uuid, { sync_status: "failed", error_message: "Network timeout" });
    all = await getSyncQueue();
    const failedItem = all.find((q) => q.client_uuid === item.client_uuid)!;
    expect(syncBadgeInfo(failedItem.sync_status).label).toBe("Failed");

    await updateSyncItem(item.client_uuid, { sync_status: "synced", server_id: 42 });
    all = await getSyncQueue();
    const syncedItem = all.find((q) => q.client_uuid === item.client_uuid)!;
    expect(syncBadgeInfo(syncedItem.sync_status).label).toBe("Synced");

    await clearSyncedItems();
    all = await getSyncQueue();
    expect(all.some((q) => q.client_uuid === item.client_uuid)).toBe(false);
  });
});
