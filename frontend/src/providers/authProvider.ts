import type { AuthProvider } from "@refinedev/core";
import type { UserProfile, TokenResponse } from "@/types/auth";

const API = "/api/auth";
const TOKEN_KEY = "aiorctest_token";

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...init, headers });
}

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const res = await apiFetch(`${API}/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return {
        success: false,
        error: { name: "LoginError", message: detail.detail || "Login failed" },
      };
    }
    const data: TokenResponse = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    return { success: true, redirectTo: "/" };
  },

  register: async ({ email, password, displayName }) => {
    const res = await apiFetch(`${API}/register`, {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        display_name: displayName || "",
      }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return {
        success: false,
        error: {
          name: "RegisterError",
          message: detail.detail || "Registration failed",
        },
      };
    }
    const loginRes = await apiFetch(`${API}/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (loginRes.ok) {
      const data: TokenResponse = await loginRes.json();
      localStorage.setItem(TOKEN_KEY, data.access_token);
    }
    return { success: true, redirectTo: "/" };
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { authenticated: false, redirectTo: "/login" };
    }
    const res = await apiFetch(`${API}/me`);
    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY);
      return { authenticated: false, redirectTo: "/login" };
    }
    return { authenticated: true };
  },

  getIdentity: async (): Promise<UserProfile | null> => {
    const res = await apiFetch(`${API}/me`);
    if (!res.ok) return null;
    return res.json();
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true, redirectTo: "/login" };
    }
    return { error };
  },
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
