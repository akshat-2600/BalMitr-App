import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function AccountPage() {
  const { user, logout } = useAuth();

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <h1 className="page-title">Account</h1>
        <p className="muted" style={{ margin: 0 }}>
          Signed-in Anganwadi worker or supervisor profile.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="eyebrow">{user?.role === "supervisor" ? "SUPERVISOR" : "ANGANWADI WORKER"}</div>
        <h2 style={{ fontSize: 24, marginTop: 4, marginBottom: 12 }}>{user?.full_name}</h2>
        <div className="stack" style={{ gap: 6, marginBottom: 20 }}>
          <div><strong>Username:</strong> {user?.username}</div>
          <div><strong>Centre:</strong> {user?.centre_name || "All centres (Supervisor)"}</div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={logout}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
