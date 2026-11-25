import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch } from "../api/client";
import { useSync } from "../context/SyncContext";
import { syncBadgeInfo } from "../offline/db";

interface HealthResponse {
  status: string;
  version: string;
  max_age_months: number;
  database_engine: string;
  counts: { centres: number; children: number; measurements: number };
}

export function BackendPage() {
  const { queue, syncing, lastSyncMessage, syncNow, clearSynced, simulateOffline, setSimulateOffline } = useSync();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<HealthResponse>("/health/")
      .then((h) => {
        setHealth(h);
        setHealthError(null);
      })
      .catch((e) => setHealthError(e.message || "Backend unreachable (offline)."));
  }, [queue]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 className="page-title">Backend & sync queue</h1>
        <p className="muted" style={{ margin: 0 }}>
          API health, database counts, Swagger link, and local IndexedDB offline queue.
        </p>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 20 }}>API health</h2>
          <a
            href="http://127.0.0.1:8000/api/docs/"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ padding: "7px 14px", fontSize: 13 }}
          >
            Open Swagger /api/docs/
            <ExternalLink size={14} />
          </a>
        </div>
        {healthError ? (
          <div className="error-banner">{healthError}</div>
        ) : !health ? (
          <div className="muted">Checking API health...</div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="chip chip-mint">Status: {health.status}</span>
              <span className="chip chip-neutral">Version: {health.version}</span>
              <span className="chip chip-neutral">DB: {health.database_engine}</span>
              <span className="chip chip-neutral">Max age: {health.max_age_months}m</span>
            </div>
            <div className="muted" style={{ fontSize: 13.5 }}>
              Database counts: {health.counts.centres} centres · {health.counts.children} children · {health.counts.measurements} measurements
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 20 }}>Offline sync queue ({queue.length})</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSimulateOffline(!simulateOffline)}
            >
              {simulateOffline ? "Go back online" : "Simulate offline"}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => syncNow()} disabled={syncing || simulateOffline}>
              <RefreshCw size={15} />
              {syncing ? "Syncing..." : "Sync now"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => clearSynced()}>
              <Trash2 size={15} />
              Clear synced
            </button>
          </div>
        </div>
        {lastSyncMessage && (
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Last sync: {lastSyncMessage}
          </div>
        )}
        {queue.length === 0 ? (
          <div className="muted">No items in the local IndexedDB queue.</div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {queue.map((item) => {
              const badge = syncBadgeInfo(item.sync_status);
              return (
                <div
                  key={item.client_uuid}
                  className="row-between"
                  style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ textTransform: "capitalize" }}>{item.type}</strong>
                      <span className={badge.className}>{badge.label}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      UUID: {item.client_uuid} · {item.created_at.slice(0, 19).replace("T", " ")}
                    </div>
                    {item.error_message && (
                      <div style={{ fontSize: 12.5, color: "var(--red-text)", marginTop: 2 }}>
                        {item.error_message}
                      </div>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {item.server_id ? `Server #${item.server_id}` : "Local only"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
