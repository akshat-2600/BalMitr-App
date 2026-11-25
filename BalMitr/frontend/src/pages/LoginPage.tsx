import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

const DEMO_ACCOUNTS = [
  { name: "Meera Kole", username: "worker1", roleLabel: "Worker" },
  { name: "Ravi Das", username: "worker2", roleLabel: "Worker" },
  { name: "Anjali Sen", username: "supervisor1", roleLabel: "Supervisor" },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("worker1");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Check the backend server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-split">
      <section className="login-left">
        <div>
          <div className="eyebrow">ANGANWADI REGISTER</div>
          <h1>BalMitr</h1>
          <p className="login-lead">
            Record a child, weigh and measure them, and read a WHO growth status before you decide on a visit.
          </p>
        </div>
        <div className="login-notes">
          <div>Weeks 1–10: login, measurements, charts, risk, food, visits, offline sync.</div>
          <div>The status is the WHO LMS formula. No invented accuracy.</div>
          <div>Three demo logins. Nothing here is a real child.</div>
        </div>
      </section>

      <section className="login-right">
        <div className="login-box">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.username}
              type="button"
              className="demo-card"
              onClick={() => {
                setUsername(acc.username);
                setPassword("demo1234");
              }}
            >
              <div className="demo-card-title">{acc.name}</div>
              <div className="demo-card-sub">
                {acc.username} · {acc.roleLabel} · password demo1234
              </div>
            </button>
          ))}

          <form className="card" onSubmit={handleSubmit}>
            <h2 style={{ fontSize: 22, marginBottom: 16 }}>Sign in</h2>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-rect" disabled={busy}>
              {busy ? "Signing in..." : "Enter the register"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
