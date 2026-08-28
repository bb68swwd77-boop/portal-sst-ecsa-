import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import type { CurrentUser } from "../types";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface MePayload {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleKey: "admin" | "user";
    permissions: string[] | Set<string>;
  };
}

function normalizeUser(raw: MePayload["user"]): CurrentUser {
  return {
    ...raw,
    permissions: Array.isArray(raw.permissions) ? raw.permissions : Array.from(raw.permissions),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<MePayload>("/auth/me");
      setUser(normalizeUser(data.user));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    await api.post("/auth/login", { email, password });
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (key: string) => Boolean(user?.permissions.includes(key)),
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, hasPermission, refresh }),
    [user, loading, login, logout, hasPermission, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
