import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { getCachedChildren, saveCachedChildren } from "../offline/db";
import { Child } from "../types";
import { isAttentionStatus, quickRiskFromChips, statusChipClass } from "../utils/status";

export function HomePage() {
  const { user } = useAuth();
  const { syncVersion, isOnline } = useSync();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (!isOnline) {
      getCachedChildren()
        .then((cached) => {
          setChildren(cached);
          setError("Offline mode: showing cached register from this device.");
        })
        .finally(() => setLoading(false));
      return;
    }
    apiFetch<Child[]>("/children/")
      .then(async (data) => {
        setChildren(data);
        await saveCachedChildren(data);
        setError(null);
      })
      .catch(async (e) => {
        const cached = await getCachedChildren();
        if (cached.length > 0) {
          setChildren(cached);
          setError("Offline mode: showing cached register from this device.");
        } else {
          setError(e.message || "Could not load register.");
        }
      })
      .finally(() => setLoading(false));
  }, [syncVersion, isOnline]);

  const firstName = (user?.full_name || user?.username || "Worker").split(" ")[0];
  const nowPrefix = new Date().toISOString().slice(0, 7);
  const measuredThisMonth = children.filter(
    (c) => c.latest && c.latest.date.startsWith(nowPrefix)
  ).length;
  const attentionList = children
    .filter((c) => (c.risk ? c.risk.level !== "Low" : isAttentionStatus(c.status_chips)))
    .sort((a, b) => (a.risk?.level === "High" ? -1 : 1) - (b.risk?.level === "High" ? -1 : 1));
  const normalCount = children.filter(
    (c) => c.latest && !isAttentionStatus(c.status_chips)
  ).length;

  return (
    <div>
      <h1 className="page-title">Good day, {firstName}.</h1>
      <p className="muted" style={{ margin: 0 }}>
        {user?.role === "supervisor" ? "All centres." : "Your centre only."} Record weight and height, then read the WHO status before you leave the visit.
      </p>

      {error && <div className="error-banner" style={{ marginTop: 16 }}>{error}</div>}

      <div className="tiles-grid">
        <div className="tile">
          <div className="tile-value">{loading ? "–" : children.length}</div>
          <div className="tile-label">Children</div>
        </div>
        <div className="tile tile-mint">
          <div className="tile-value">{loading ? "–" : measuredThisMonth}</div>
          <div className="tile-label">Measured this month</div>
        </div>
        <div className="tile tile-mint">
          <div className="tile-value">{loading ? "–" : normalCount}</div>
          <div className="tile-label">Inside normal cut-offs</div>
        </div>
        <div className="tile tile-red">
          <div className="tile-value">{loading ? "–" : attentionList.length}</div>
          <div className="tile-label">Need attention</div>
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 21 }}>Needs a visit</h2>
        <Link to="/alerts" style={{ color: "var(--green)", fontWeight: 600, textDecoration: "none", fontSize: 13 }}>
          All alerts
        </Link>
      </div>

      {loading ? (
        <div className="card muted">Loading children...</div>
      ) : attentionList.length === 0 ? (
        <div className="card muted">
          All measured children are currently within normal WHO cut-offs.
        </div>
      ) : (
        <div className="stack">
          {attentionList.map((child) => {
            const risk = child.risk?.level || quickRiskFromChips(child.status_chips);
            const sexLabel = child.sex === "M" ? "Boy" : "Girl";
            return (
              <Link key={child.id} to={`/children/${child.id}`} className="child-row-card">
                <div className="avatar-circle">{child.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{child.name}</strong>
                    <span className={risk === "High" ? "chip chip-red" : "chip chip-amber"}>
                      {risk}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {child.age_display} · {sexLabel} · {child.centre_name}
                  </div>
                  <div className="chips-wrap">
                    {child.status_chips.map((chip, idx) => (
                      <span key={idx} className={statusChipClass(chip)}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Link to="/children?new=1" className="btn btn-primary">
          <Plus size={16} />
          Register a child
        </Link>
        <Link to="/children" className="btn btn-secondary">
          <Users size={16} />
          Open the register
        </Link>
      </div>
    </div>
  );
}
