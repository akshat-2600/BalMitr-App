import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import {
  getCachedCentres,
  getCachedChildren,
  saveCachedCentres,
  saveCachedChildren,
  syncBadgeInfo,
} from "../offline/db";
import { Centre, Child } from "../types";
import { ageInMonths, MAX_AGE_MONTHS } from "../utils/age";
import { statusChipClass } from "../utils/status";

export function ChildrenPage() {
  const { user } = useAuth();
  const { queue, syncVersion, isOnline, queueChild } = useSync();
  const [searchParams, setSearchParams] = useSearchParams();
  const [children, setChildren] = useState<Child[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sex, setSex] = useState<"M" | "F">("M");
  const [dob, setDob] = useState("");
  const [guardian, setGuardian] = useState("");
  const [centreId, setCentreId] = useState<number>(user?.centre_id || 0);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    if (!isOnline) {
      const [cachedKids, cachedCtrs] = await Promise.all([
        getCachedChildren(),
        getCachedCentres(),
      ]);
      setChildren(cachedKids);
      setCentres(cachedCtrs);
      if (!centreId && cachedCtrs.length > 0) {
        setCentreId(user?.centre_id || cachedCtrs[0].id);
      }
      setNotice("Offline mode: showing children cached on this device.");
      setLoading(false);
      return;
    }
    try {
      const [kids, ctrs] = await Promise.all([
        apiFetch<Child[]>("/children/"),
        apiFetch<Centre[]>("/centres/"),
      ]);
      await saveCachedChildren(kids);
      await saveCachedCentres(ctrs);
      const merged = await getCachedChildren();
      setChildren(merged.length > 0 ? merged : kids);
      setCentres(ctrs);
      if (!centreId && ctrs.length > 0) {
        setCentreId(user?.centre_id || ctrs[0].id);
      }
      setNotice(null);
    } catch (e) {
      const [cachedKids, cachedCtrs] = await Promise.all([
        getCachedChildren(),
        getCachedCentres(),
      ]);
      setChildren(cachedKids);
      setCentres(cachedCtrs);
      if (!centreId && cachedCtrs.length > 0) {
        setCentreId(user?.centre_id || cachedCtrs[0].id);
      }
      setNotice(
        cachedKids.length > 0
          ? "Offline mode: showing children cached on this device."
          : e instanceof ApiError
          ? e.message
          : "Offline mode: no cached children yet."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [syncVersion, isOnline]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!dob) {
      setFormError("Please enter the child's date of birth.");
      return;
    }
    const months = ageInMonths(dob);
    if (months < 0) {
      setFormError("Date of birth cannot be in the future.");
      return;
    }
    if (months > MAX_AGE_MONTHS) {
      setFormError(`Child age (${months} months) exceeds the ${MAX_AGE_MONTHS}-month (12 years) register limit.`);
      return;
    }

    setSaving(true);
    try {
      const selectedCentre = centres.find((c) => c.id === centreId);
      const res = await queueChild({
        name: name.trim(),
        sex,
        date_of_birth: dob,
        guardian_name: guardian.trim(),
        centre: centreId || user?.centre_id || 1,
        centre_name: selectedCentre?.name || user?.centre_name || "Your centre",
      });
      setName("");
      setDob("");
      setGuardian("");
      setShowForm(false);
      setSearchParams({});
      if (res.queuedOffline) {
        setNotice("Saved offline in IndexedDB. It will sync when you are back online.");
        setChildren(await getCachedChildren());
      } else {
        await loadData();
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save child.");
    } finally {
      setSaving(false);
    }
  }

  const queueByUuid = new Map(queue.map((q) => [q.client_uuid, q]));
  const filtered = children.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.centre_name.toLowerCase().includes(query.toLowerCase()) ||
      c.guardian_name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Children</h1>
          <p className="muted" style={{ margin: 0 }}>
            Birth to 12 years ({MAX_AGE_MONTHS} completed months).
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowForm((s) => !s)}
        >
          <Plus size={16} />
          {showForm ? "Close form" : "Register a child"}
        </button>
      </div>

      {notice && (
        <div
          style={{
            background: "var(--amber-chip)",
            color: "var(--amber-text)",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      )}

      {showForm && (
        <form className="card" style={{ marginBottom: 22 }} onSubmit={handleCreate}>
          <h2 style={{ fontSize: 20, marginBottom: 14 }}>Register a child</h2>
          {formError && <div className="error-banner">{formError}</div>}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="child-name">Child full name</label>
              <input
                id="child-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kavya Deshmukh"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="child-sex">Sex</label>
              <select
                id="child-sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as "M" | "F")}
              >
                <option value="M">Boy</option>
                <option value="F">Girl</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="child-dob">Date of birth</label>
              <input
                id="child-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="child-guardian">Parent / guardian name</label>
              <input
                id="child-guardian"
                value={guardian}
                onChange={(e) => setGuardian(e.target.value)}
                placeholder="e.g. Sunita Deshmukh"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="child-centre">Anganwadi centre</label>
            <select
              id="child-centre"
              value={centreId}
              onChange={(e) => setCentreId(Number(e.target.value))}
              disabled={user?.role === "worker"}
            >
              {centres.length > 0 ? (
                centres.map((ctr) => (
                  <option key={ctr.id} value={ctr.id}>
                    {ctr.name} ({ctr.code})
                  </option>
                ))
              ) : (
                <option value={user?.centre_id || 1}>{user?.centre_name || "Your centre"}</option>
              )}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save child"}
          </button>
        </form>
      )}

      <div className="field" style={{ maxWidth: 420 }}>
        <div style={{ position: "relative" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }}
          />
          <input
            style={{ paddingLeft: 36, background: "var(--bg-card)", border: "1px solid var(--border)" }}
            placeholder="Search by child, guardian, or centre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="card muted">Loading register...</div>
      ) : filtered.length === 0 ? (
        <div className="card muted">
          No children match this view yet. Click &ldquo;Register a child&rdquo; to add one.
        </div>
      ) : (
        <div className="stack">
          {filtered.map((child) => {
            const qItem = queueByUuid.get(child.client_uuid);
            const badge = qItem ? syncBadgeInfo(qItem.sync_status) : syncBadgeInfo("synced");
            const profilePath = child.id > 0 ? `/children/${child.id}` : `/children/${child.client_uuid}`;
            return (
              <Link key={child.client_uuid || child.id} to={profilePath} className="child-row-card">
                <div className="avatar-circle">{child.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div className="row-between">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 15 }}>{child.name}</strong>
                      <span className={badge.className} style={{ fontSize: 11 }}>{badge.label}</span>
                    </div>
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {child.latest ? `Last weighed ${child.latest.date}` : "Not weighed yet"}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {child.age_display} · {child.sex === "M" ? "Boy" : "Girl"} · {child.centre_name}
                    {child.guardian_name ? ` · Guardian: ${child.guardian_name}` : ""}
                  </div>
                  {child.status_chips.length > 0 && (
                    <div className="chips-wrap">
                      {child.status_chips.map((c, idx) => (
                        <span key={idx} className={statusChipClass(c)}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
