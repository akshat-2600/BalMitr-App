import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, ShieldAlert, TrendingUp, Utensils } from "lucide-react";
import { apiFetch, ApiError } from "../api/client";
import { GrowthCharts } from "../components/GrowthCharts";
import { useSync } from "../context/SyncContext";
import { getCachedChildren, syncBadgeInfo } from "../offline/db";
import { Child, FollowUp, HomeVisit, Measurement, Referral } from "../types";
import { FoodSuggestionsResponse, GrowthHistoryResponse } from "../types_growth";
import { ageInMonths } from "../utils/age";
import { statusChipClass } from "../utils/status";

export function ChildProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { queue, syncVersion, isOnline, queueMeasurement } = useSync();
  const [child, setChild] = useState<Child | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [history, setHistory] = useState<GrowthHistoryResponse | null>(null);
  const [foods, setFoods] = useState<FoodSuggestionsResponse | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [visits, setVisits] = useState<HomeVisit[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [visitNotes, setVisitNotes] = useState("");
  const [refFacility, setRefFacility] = useState("");
  const [refReason, setRefReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [mDate, setMDate] = useState(todayStr);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [position, setPosition] = useState<"lying" | "standing">("standing");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    if (!id) return;
    setLoading(true);
    setError(null);

    const isNumeric = /^\d+$/.test(id);
    // If viewing an offline child by client_uuid that has now synced to server_id, redirect cleanly
    if (!isNumeric) {
      const syncedEntry = queue.find((q) => q.type === "child" && q.client_uuid === id && q.server_id);
      if (syncedEntry?.server_id) {
        navigate(`/children/${syncedEntry.server_id}`, { replace: true });
        return;
      }
    }

    if (!isNumeric || !isOnline) {
      const cached = await getCachedChildren();
      const found = cached.find((c) => (isNumeric ? String(c.id) === id : c.client_uuid === id)) || null;
      if (found) {
        setChild(found);
        setMeasurements(found.latest ? [found.latest] : []);
        setPosition(found.age_months < 24 ? "lying" : "standing");
        setOfflineNotice("Offline mode: new measurements are saved in IndexedDB and wait to sync.");
      } else {
        setError("Child not found in offline cache.");
      }
      setLoading(false);
      return;
    }

    try {
      const [c, ms, hist, fd, fu, vs, rf] = await Promise.all([
        apiFetch<Child>(`/children/${id}/`),
        apiFetch<Measurement[]>(`/measurements/?child=${id}`),
        apiFetch<GrowthHistoryResponse>(`/children/${id}/growth-history/`),
        apiFetch<FoodSuggestionsResponse>(`/children/${id}/food-suggestions/`),
        apiFetch<FollowUp[]>(`/follow-ups/?child=${id}`),
        apiFetch<HomeVisit[]>(`/visits/?child=${id}`),
        apiFetch<Referral[]>(`/referrals/?child=${id}`),
      ]);
      setChild(c);
      setMeasurements(ms);
      setHistory(hist);
      setFoods(fd);
      setFollowUps(fu);
      setVisits(vs);
      setReferrals(rf);
      setPosition(c.age_months < 24 ? "lying" : "standing");
      setOfflineNotice(null);
    } catch (e) {
      const cached = await getCachedChildren();
      const found = cached.find((c) => String(c.id) === id);
      if (found) {
        setChild(found);
        setMeasurements(found.latest ? [found.latest] : []);
        setPosition(found.age_months < 24 ? "lying" : "standing");
        setOfflineNotice("Offline mode: showing cached child profile. New measurements will queue for sync.");
      } else {
        setError(e instanceof ApiError ? e.message : "Could not load child profile.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [id, syncVersion, isOnline]);

  useEffect(() => {
    if (!child || !mDate) return;
    try {
      const m = ageInMonths(child.date_of_birth, mDate);
      setPosition(m < 24 ? "lying" : "standing");
    } catch {
      // ignore invalid date during typing
    }
  }, [mDate, child]);

  async function handleSaveMeasurement(e: FormEvent) {
    e.preventDefault();
    if (!child) return;
    setFormError(null);
    const w = Number(weight);
    const h = Number(height);
    if (!(w >= 0.5 && w <= 100)) {
      setFormError("Weight must be between 0.5 and 100 kg.");
      return;
    }
    if (!(h >= 30 && h <= 185)) {
      setFormError("Height must be between 30 and 185 cm.");
      return;
    }
    if (mDate > todayStr) {
      setFormError("Measurement date cannot be in the future.");
      return;
    }
    if (mDate < child.date_of_birth) {
      setFormError("Date is before the child's date of birth.");
      return;
    }

    setSaving(true);
    try {
      const res = await queueMeasurement({
        child: child.id > 0 ? child.id : undefined,
        child_client_uuid: child.client_uuid,
        date: mDate,
        weight_kg: w,
        height_cm: h,
        measured_position: position,
      });
      setWeight("");
      setHeight("");
      if (res.queuedOffline) {
        setOfflineNotice("Measurement saved offline in IndexedDB. Press Sync when back online.");
      } else {
        await loadProfile();
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save measurement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVisit(e: FormEvent) {
    e.preventDefault();
    if (!child || !visitNotes.trim()) return;
    await apiFetch("/visits/", {
      method: "POST",
      body: JSON.stringify({ child: child.id, visit_date: todayStr, notes: visitNotes.trim() }),
    });
    setVisitNotes("");
    await loadProfile();
  }

  async function handleAddReferral(e: FormEvent) {
    e.preventDefault();
    if (!child || !refFacility.trim() || !refReason.trim()) return;
    await apiFetch("/referrals/", {
      method: "POST",
      body: JSON.stringify({
        child: child.id,
        facility: refFacility.trim(),
        reason: refReason.trim(),
        referred_date: todayStr,
      }),
    });
    setRefFacility("");
    setRefReason("");
    await loadProfile();
  }

  if (loading) return <div className="card muted">Loading profile...</div>;
  if (error || !child) {
    return (
      <div>
        <Link to="/children" className="btn btn-secondary" style={{ marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back to register
        </Link>
        <div className="error-banner">{error || "Child not found."}</div>
      </div>
    );
  }

  const latest = measurements[0] || null;
  const ageAtDate = ageInMonths(child.date_of_birth, mDate);
  const expectedPos = ageAtDate < 24 ? "lying" : "standing";
  const willAdjust = position !== expectedPos;
  const childQueueItems = queue.filter(
    (q) =>
      q.type === "measurement" &&
      q.sync_status !== "synced" &&
      (q.payload.child === child.id || q.payload.child_client_uuid === child.client_uuid)
  );
  const childSyncItem = queue.find((q) => q.type === "child" && q.client_uuid === child.client_uuid);
  const childBadge = childSyncItem ? syncBadgeInfo(childSyncItem.sync_status) : syncBadgeInfo("synced");

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <Link to="/children" style={{ color: "var(--green)", fontWeight: 600, textDecoration: "none", fontSize: 13 }}>
          ← Back to Children
        </Link>
      </div>

      {offlineNotice && (
        <div style={{ background: "var(--amber-chip)", color: "var(--amber-text)", borderRadius: 12, padding: "10px 14px", fontSize: 13 }}>
          {offlineNotice}
        </div>
      )}

      <div className="card">
        <div className="row-between">
          <div>
            <div className="eyebrow">{child.centre_name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{child.name}</h1>
              <span className={childBadge.className}>{childBadge.label}</span>
            </div>
            <div className="muted">
              {child.age_display} · {child.sex === "M" ? "Boy" : "Girl"} · DOB {child.date_of_birth}
              {child.guardian_name ? ` · Guardian: ${child.guardian_name}` : ""}
            </div>
          </div>
          {latest && (
            <div className="chips-wrap" style={{ marginTop: 0 }}>
              {child.status_chips.map((c, i) => (
                <span key={i} className={statusChipClass(c)}>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {latest?.is_flagged && (
        <div className="error-banner" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>WHO flag check:</strong> {latest.flag_reasons.join(" ")}
          </div>
        </div>
      )}

      {child.risk && (
        <div className="card">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={18} color="var(--green)" />
              <h2 style={{ fontSize: 19 }}>Risk assessment</h2>
              <span
                className={
                  child.risk.level === "High"
                    ? "chip chip-red"
                    : child.risk.level === "Moderate"
                    ? "chip chip-amber"
                    : "chip chip-mint"
                }
              >
                {child.risk.level} risk
              </span>
            </div>
            <span className="chip chip-neutral">{child.risk.notice}</span>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {child.risk.reasons.map((r, i) => (
              <div key={i} style={{ fontSize: 13.5 }}>
                <span className="chip chip-neutral" style={{ marginRight: 8, fontSize: 11 }}>
                  {r.rule_id}
                </span>
                {r.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {history && history.trends.length > 0 && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <TrendingUp size={18} color="var(--green)" />
            <h2 style={{ fontSize: 18 }}>Growth trend</h2>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {history.trends.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={t.severity === "warning" ? "chip chip-amber" : "chip chip-mint"}>
                  {t.severity === "warning" ? "Attention" : "On track"}
                </span>
                <span>{t.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2">
        <form className="card" onSubmit={handleSaveMeasurement}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Record measurement</h2>
          {formError && <div className="error-banner">{formError}</div>}
          <div className="field">
            <label htmlFor="m-date">Date</label>
            <input
              id="m-date"
              type="date"
              value={mDate}
              max={todayStr}
              onChange={(e) => setMDate(e.target.value)}
              required
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="m-weight">Weight (kg)</label>
              <input
                id="m-weight"
                type="number"
                step="0.01"
                min="0.5"
                max="100"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 7.20"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="m-height">Length / height (cm)</label>
              <input
                id="m-height"
                type="number"
                step="0.1"
                min="30"
                max="185"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 70.5"
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="m-pos">Measuring position</label>
            <select
              id="m-pos"
              value={position}
              onChange={(e) => setPosition(e.target.value as "lying" | "standing")}
            >
              <option value="lying">Lying down (length — standard under 24m)</option>
              <option value="standing">Standing (height — standard 24m+)</option>
            </select>
            {willAdjust && (
              <div className="muted" style={{ fontSize: 12 }}>
                WHO 0.7 cm adjustment will be applied automatically for age {ageAtDate} months.
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Calculating WHO status..." : "Save measurement"}
          </button>
        </form>

        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Latest WHO indicators</h2>
          {!latest ? (
            <p className="muted">No measurements recorded yet. Enter weight and height to calculate WHO status.</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              <div className="muted" style={{ fontSize: 13 }}>
                Measured on {latest.date} · {latest.weight_kg} kg · {latest.height_cm} cm ({latest.measured_position})
                {Number(latest.adjusted_height_cm) !== Number(latest.height_cm) &&
                  ` → adjusted ${latest.adjusted_height_cm} cm`}
              </div>
              <div className="row-between">
                <span>Weight-for-age</span>
                <span>
                  <span className={statusChipClass(latest.status)}>{latest.status}</span>{" "}
                  {latest.weight_for_age_z !== null && <span className="muted">Z = {latest.weight_for_age_z}</span>}
                </span>
              </div>
              <div className="row-between">
                <span>Height-for-age</span>
                <span>
                  <span className={statusChipClass(latest.height_status)}>{latest.height_status}</span>{" "}
                  {latest.height_for_age_z !== null && <span className="muted">Z = {latest.height_for_age_z}</span>}
                </span>
              </div>
              <div className="row-between">
                <span>Weight-for-height</span>
                <span>
                  <span className={statusChipClass(latest.wfh_status)}>{latest.wfh_status}</span>{" "}
                  {latest.weight_for_height_z !== null && <span className="muted">Z = {latest.weight_for_height_z}</span>}
                </span>
              </div>
              {latest.age_months > 60 && (
                <div className="row-between">
                  <span>BMI-for-age</span>
                  <span>
                    <span className={statusChipClass(latest.bmi_status)}>{latest.bmi_status}</span>{" "}
                    {latest.bmi_for_age_z !== null && <span className="muted">Z = {latest.bmi_for_age_z}</span>}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {history && <GrowthCharts charts={history.charts} measurements={history.measurements} />}

      {foods && (
        <div className="card">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Utensils size={18} color="var(--green)" />
              <h2 style={{ fontSize: 20 }}>Food suggestions</h2>
            </div>
            <span className="chip chip-amber">{foods.notice}</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Focus nutrients: {foods.needs.map((n) => n.replace("_", " ")).join(", ")} · Age-safe for {child.age_display}
          </div>
          {foods.safety_notes.length > 0 && (
            <div className="stack" style={{ gap: 4, marginBottom: 12 }}>
              {foods.safety_notes.map((note, idx) => (
                <div key={idx} style={{ fontSize: 13, color: "var(--amber-text)", background: "var(--amber-chip)", padding: "6px 10px", borderRadius: 8 }}>
                  {note}
                </div>
              ))}
            </div>
          )}
          {foods.suggestions.length === 0 ? (
            <div className="muted">No solid foods suggested for this age.</div>
          ) : (
            <div className="grid-2">
              {foods.suggestions.map((f) => (
                <div key={f.id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12, background: "#fff" }}>
                  <div style={{ fontWeight: 700 }}>
                    {f.name} {f.local_name ? <span className="muted" style={{ fontWeight: 400 }}>({f.local_name})</span> : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{f.serving_note}</div>
                  <div className="chips-wrap" style={{ marginTop: 8 }}>
                    {f.tag_energy && <span className="chip chip-mint">Energy</span>}
                    {f.tag_protein && <span className="chip chip-mint">Protein</span>}
                    {f.tag_iron && <span className="chip chip-mint">Iron</span>}
                    {f.tag_vitamin_a && <span className="chip chip-mint">Vitamin A</span>}
                    <span className="chip chip-neutral">{f.min_age_months}m+ · {f.texture}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Follow-ups, visits & referrals</h2>
        {child.progress && (
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              className={
                child.progress.status === "improved"
                  ? "chip chip-mint"
                  : child.progress.status === "worse"
                  ? "chip chip-red"
                  : "chip chip-neutral"
              }
            >
              Progress: {child.progress.status}
            </span>
            <span style={{ fontSize: 13.5 }}>{child.progress.summary}</span>
          </div>
        )}
        <div className="grid-2">
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Home visits ({visits.length}) & Follow-ups ({followUps.length})</h3>
            {followUps.map((f) => (
              <div key={f.id} style={{ fontSize: 13, marginBottom: 6 }}>
                <span className={f.status === "overdue" ? "chip chip-red" : f.status === "done" ? "chip chip-mint" : "chip chip-amber"} style={{ marginRight: 6 }}>
                  {f.status}
                </span>
                {f.due_date}: {f.reason}
              </div>
            ))}
            {visits.map((v) => (
              <div key={v.id} style={{ fontSize: 13, marginBottom: 6 }}>
                <strong>{v.visit_date}:</strong> {v.notes}
              </div>
            ))}
            <form onSubmit={handleAddVisit} style={{ marginTop: 10 }}>
              <div className="field" style={{ marginBottom: 8 }}>
                <input
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Log a home visit note..."
                />
              </div>
              <button type="submit" className="btn btn-secondary">Save home visit</button>
            </form>
          </div>
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Referrals ({referrals.length})</h3>
            {referrals.map((r) => (
              <div key={r.id} style={{ fontSize: 13, marginBottom: 6 }}>
                <span className="chip chip-neutral" style={{ marginRight: 6 }}>{r.status}</span>
                <strong>{r.facility}</strong> ({r.referred_date}) — {r.reason}
              </div>
            ))}
            <form onSubmit={handleAddReferral} style={{ marginTop: 10 }}>
              <div className="field" style={{ marginBottom: 8 }}>
                <input
                  value={refFacility}
                  onChange={(e) => setRefFacility(e.target.value)}
                  placeholder="Facility (e.g. NRC District Hospital)"
                />
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <input
                  value={refReason}
                  onChange={(e) => setRefReason(e.target.value)}
                  placeholder="Referral reason..."
                />
              </div>
              <button type="submit" className="btn btn-secondary">Record referral</button>
            </form>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>
          Measurement history ({measurements.length + childQueueItems.length})
        </h2>
        {childQueueItems.map((q) => {
          const b = syncBadgeInfo(q.sync_status);
          return (
            <div
              key={q.client_uuid}
              className="row-between"
              style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <strong>{String(q.payload.date)}</strong> · {String(q.payload.weight_kg)} kg · {String(q.payload.height_cm)} cm ({String(q.payload.measured_position)})
              </div>
              <span className={b.className}>{b.label}</span>
            </div>
          );
        })}
        {measurements.length === 0 && childQueueItems.length === 0 ? (
          <div className="muted">No visits recorded yet.</div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {measurements.map((m) => (
              <div
                key={m.id}
                className="row-between"
                style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}
              >
                <div>
                  <strong>{m.date}</strong> · {m.weight_kg} kg · {m.height_cm} cm ({m.measured_position})
                </div>
                <div className="chips-wrap" style={{ marginTop: 0 }}>
                  {m.status !== "Not applicable for this age" && (
                    <span className={statusChipClass(m.status)}>{m.status}</span>
                  )}
                  <span className={statusChipClass(m.height_status)}>{m.height_status}</span>
                  {m.wfh_status !== "Not applicable for this age" && (
                    <span className={statusChipClass(m.wfh_status)}>{m.wfh_status}</span>
                  )}
                  {m.bmi_status !== "Not applicable for this age" && (
                    <span className={statusChipClass(m.bmi_status)}>{m.bmi_status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
