import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { Child } from "../types";
import { statusChipClass } from "../utils/status";

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Child[]>([]);
  const [filter, setFilter] = useState<"All" | "High" | "Moderate">("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Child[]>("/alerts/")
      .then(setAlerts)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load alerts."))
      .finally(() => setLoading(false));
  }, []);

  const visible = alerts.filter((c) => filter === "All" || c.risk?.level === filter);

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="muted" style={{ margin: 0 }}>
            Children needing attention, sorted High risk first (rule-based: proposed, needs expert review).
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["All", "High", "Moderate"] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={`btn ${filter === lvl ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "6px 14px", fontSize: 13 }}
              onClick={() => setFilter(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="card muted">Loading alerts...</div>
      ) : visible.length === 0 ? (
        <div className="card muted">No children in this risk level right now.</div>
      ) : (
        <div className="stack">
          {visible.map((child) => {
            const level = child.risk?.level || "Moderate";
            return (
              <Link key={child.id} to={`/children/${child.id}`} className="child-row-card">
                <div className="avatar-circle">{child.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{child.name}</strong>
                    <span className={level === "High" ? "chip chip-red" : "chip chip-amber"}>
                      {level} risk
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {child.age_display} · {child.sex === "M" ? "Boy" : "Girl"} · {child.centre_name}
                  </div>
                  {child.risk?.reasons && (
                    <div className="stack" style={{ gap: 4, marginTop: 8 }}>
                      {child.risk.reasons.map((r, i) => (
                        <div key={i} style={{ fontSize: 12.5 }}>
                          <span className="chip chip-neutral" style={{ marginRight: 6, fontSize: 11 }}>{r.rule_id}</span>
                          {r.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="chips-wrap">
                    {child.status_chips.map((c, idx) => (
                      <span key={idx} className={statusChipClass(c)}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
