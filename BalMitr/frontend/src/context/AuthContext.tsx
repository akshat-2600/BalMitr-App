import React, { createContext, useContext, useState } from "react";
import { apiFetch, AuthUser, getStoredAuth, setStoredAuth } from "../api/client";

interface AuthCtx {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuth());

  async function login(username: string, password: string) {
    const data = await apiFetch<AuthUser>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setStoredAuth(data);
    setUser(data);
  }

  function logout() {
    setStoredAuth(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
