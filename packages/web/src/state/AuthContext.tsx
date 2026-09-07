import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../api/http";

export interface AuthUser {
  id: string;
  name: string;
  isAdmin: boolean;
}
export interface AuthCampaign {
  id: string;
  name: string;
  dmTone: string;
}

interface AuthState {
  token: string;
  user: AuthUser;
  campaign: AuthCampaign;
}

interface AuthContextValue {
  auth: AuthState | null;
  join: (inviteCode: string, name: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "dnd-ai-sim-auth";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStored(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => loadStored());

  useEffect(() => {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(STORAGE_KEY);
  }, [auth]);

  async function join(inviteCode: string, name: string) {
    const result = await apiFetch<AuthState>("/api/auth/join", {
      method: "POST",
      body: { inviteCode, name },
    });
    setAuth(result);
  }

  function logout() {
    setAuth(null);
  }

  return <AuthContext.Provider value={{ auth, join, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
