import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import { apiFetch, ApiError } from "../api/client";
import { Child, FollowUp, HomeVisit, Referral } from "../types";

export function VisitsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [visits, setVisits] = useState<HomeVisit[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [tab, setTab] = useState<"due_today" | "overdue" | "done" | "upcoming">("due_today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick follow-up creation
  const [showNew, setShowNew] = useState(false);
  const [childId, setChildId] = useState<number>(0);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [fu, vs, rf, kids] = await Promise.all([
        apiFetch<FollowUp[]>("/follow-ups/"),
        apiFetch<HomeVisit[]>("/visits/"),
        apiFetch<Referral[]>("/referrals/"),
        apiFetch<Child[]>("/children/"),
      ]);
      setFollowUps(fu);
      setVisits(vs);
      setReferrals(rf);
      setChildren(kids);
      if (!childId && kids.length > 0) setChildId(kids[0].id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load visits.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const buckets = {
    due_today: followUps.filter((f) => f.status !== "done" && f.due_date === todayStr),
    overdue: followUps.filter((f) => f.status === "overdue" || (f.status === "pending" && f.due_date < todayStr)),
    done: followUps.filter((f) => f.status === "done"),
    upcoming: followUps.filter((f) => f.status === "pending" && f.due_date > todayStr),
  };

  async function markDone(id: number) {
    await apiFetch(`/follow-ups/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    });
    await loadAll();
  }

  async function updateReferralStatus(id: number, status: Referral["status"]) {
    await apiFetch(`/referrals/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadAll();
  }

  async function createFollowUp(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await apiFetch("/follow-ups/", {
        method: "POST",
        body: JSON.stringify({ child: childId, due_date: dueDate, reason }),
      });
      setReason("");
      setShowNew(false);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create follow-up.");
    }
  }

  const visible = buckets[tab];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row-between">
        <div>
          <h1 className="page-title">Visits & follow-ups</h1>
          <p className="muted" style={{ margin: 0 }}>
            Due today, overdue reminders, home visits, and facility referrals.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>
          <Plus size={16} />
          Schedule follow-up
        </button>
      </div>

      {showNew && (
        <form className="card" onSubmit={createFollowUp}>
          <h2 style={{ fontSize: 19, marginBottom: 12 }}>Schedule follow-up</h2>
          {formError && <div className="error-banner">{formError}</div>}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="fu-child">Child</label>
              <select id="fu-child" value={childId} onChange={(e) => setChildId(Number(e.target.value))}>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.age_display})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fu-date">Due date</label>
              <input id="fu-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="fu-reason">Reason</label>
            <input
              id="fu-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Re-weigh after nutrition counseling"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">Save follow-up</button>
        </form>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(
          [
            ["due_today", `Due today (${buckets.due_today.length})`],
            ["overdue", `Overdue (${buckets.overdue.length})`],
            ["done", `Done (${buckets.done.length})`],
            ["upcoming", `Upcoming (${buckets.upcoming.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`btn ${tab === k ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "7px 14px", fontSize: 13 }}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card muted">Loading visits...</div>
      ) : visible.length === 0 ? (
        <div className="card muted">No follow-ups in this tab.</div>
      ) : (
        <div className="stack">
          {visible.map((f) => (
            <div key={f.id} className="card row-between">
              <div>
                <Link to={`/children/${f.child}`} style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", textDecoration: "none" }}>
                  {f.child_name}
                </Link>{" "}
                <span className={f.status === "overdue" ? "chip chip-red" : f.status === "done" ? "chip chip-mint" : "chip chip-amber"}>
                  {f.status}
                </span>
                <div style={{ marginTop: 4 }}>{f.reason}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Due {f.due_date} · {f.centre_name}
                  {f.completed_at ? ` · Done ${f.completed_at}` : ""}
                </div>
              </div>
              {f.status !== "done" && (
                <button type="button" className="btn btn-secondary" onClick={() => markDone(f.id)}>
                  <Check size={15} />
                  Mark done
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h2 style={{ fontSize: 19, marginBottom: 12 }}>Recent home visits ({visits.length})</h2>
          {visits.length === 0 ? (
            <div className="muted">No home visits logged yet.</div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {visits.map((v) => (
                <div key={v.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>
                    <Link to={`/children/${v.child}`} style={{ color: "var(--text)", textDecoration: "none" }}>{v.child_name}</Link>
                    <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12.5 }}>{v.visit_date}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>{v.notes}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 19, marginBottom: 12 }}>Referrals ({referrals.length})</h2>
          {referrals.length === 0 ? (
            <div className="muted">No referrals recorded yet.</div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {referrals.map((r) => (
                <div key={r.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  <div className="row-between">
                    <div>
                      <Link to={`/children/${r.child}`} style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
                        {r.child_name}
                      </Link>{" "}
                      → <strong>{r.facility}</strong>
                    </div>
                    <select
                      value={r.status}
                      onChange={(e) => updateReferralStatus(r.id, e.target.value as Referral["status"])}
                      style={{ background: "var(--bg-input)", border: "none", borderRadius: 8, padding: "4px 8px", fontSize: 12 }}
                    >
                      <option value="open">Open</option>
                      <option value="visited">Visited</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{r.reason} · {r.referred_date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
