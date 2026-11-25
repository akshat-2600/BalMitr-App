import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";

interface CentreSummary {
  centre_id: number;
  centre_name: string;
  code: string;
  total_children: number;
  measured_this_month: number;
  risk_counts: { High: number; Moderate: number; Low: number };
  status_counts: Record<string, number>;
}

export function SummaryPage() {
  const [centres, setCentres] = useState<CentreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ centres: CentreSummary[] }>("/summary/")
      .then((res) => setCentres(res.centres))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load summary."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <h1 className="page-title">Summary</h1>
        <p className="muted" style={{ margin: 0 }}>
          Read-only growth status and risk counts per centre.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="card muted">Loading summary...</div>
      ) : centres.length === 0 ? (
        <div className="card muted">No centres found.</div>
      ) : (
        centres.map((c) => (
          <div key={c.centre_id} className="card">
            <div className="row-between" style={{ marginBottom: 14 }}>
              <div>
                <div className="eyebrow">{c.code}</div>
                <h2 style={{ fontSize: 22 }}>{c.centre_name}</h2>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="chip chip-neutral">{c.total_children} children</span>
                <span className="chip chip-mint">{c.measured_this_month} measured this month</span>
              </div>
            </div>

            <div className="grid-2">
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>By risk level</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="chip chip-red">High: {c.risk_counts.High}</span>
                  <span className="chip chip-amber">Moderate: {c.risk_counts.Moderate}</span>
                  <span className="chip chip-mint">Low: {c.risk_counts.Low}</span>
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>By WHO indicator status</h3>
                <div className="chips-wrap" style={{ marginTop: 0 }}>
                  {Object.entries(c.status_counts).length === 0 ? (
                    <span className="muted">No measurements yet.</span>
                  ) : (
                    Object.entries(c.status_counts).map(([label, count]) => (
                      <span key={label} className="chip chip-neutral">
                        {label}: {count}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
