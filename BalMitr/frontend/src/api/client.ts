const API_BASE = "/api";

export interface AuthUser {
  access: string;
  refresh: string;
  username: string;
  full_name: string;
  role: "worker" | "supervisor";
  centre_id: number | null;
  centre_name: string | null;
}

const STORAGE_KEY = "balmitr_auth";

export function getStoredAuth(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(user: AuthUser | null): void {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export class ApiError extends Error {
  code: string;
  details: unknown;
  status: number;
  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const auth = getStoredAuth();
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (auth?.access && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${auth.access}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      res.status,
      err?.code || "error",
      err?.message || `Request failed (${res.status})`,
      err?.details || data
    );
  }
  return data as T;
}
