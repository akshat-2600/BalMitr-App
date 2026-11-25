import { NavLink, Outlet } from "react-router-dom";
import {
  Bell,
  Footprints,
  Home,
  LayoutGrid,
  RefreshCw,
  Server,
  UserCircle,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/children", label: "Children", icon: Users },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/visits", label: "Visits", icon: Footprints },
  { to: "/summary", label: "Summary", icon: LayoutGrid },
  { to: "/backend", label: "Backend", icon: Server },
  { to: "/account", label: "Account", icon: UserCircle },
];

export function AppShell() {
  const { user } = useAuth();
  const { waitingCount, syncing, syncNow, isOnline, simulateOffline, setSimulateOffline } = useSync();

  const roleText = user?.role === "supervisor" ? "Supervisor" : "Anganwadi worker";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="eyebrow">NUTRITION REGISTER</div>
          <h1>BalMitr</h1>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="muted" style={{ fontSize: 13 }}>
            {user?.full_name || user?.username} · {roleText}
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className={`chip ${isOnline ? "chip-neutral" : "chip-amber"}`}
              style={{ border: "none", cursor: "pointer" }}
              title="Click to toggle offline simulation mode for testing"
              onClick={() => setSimulateOffline(!simulateOffline)}
            >
              {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              {isOnline ? "Online" : "Offline"}
            </button>
            <button
              type="button"
              className="sync-btn"
              onClick={() => syncNow()}
              disabled={syncing || !isOnline}
            >
              <RefreshCw size={14} />
              <span>{syncing ? "Syncing..." : "Sync"}</span>
              {waitingCount > 0 && (
                <span className="chip chip-amber" style={{ padding: "1px 7px" }}>
                  {waitingCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
