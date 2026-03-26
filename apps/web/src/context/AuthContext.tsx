import type { JwtAccessPayload } from "@onboarding/shared";
import axios from "axios";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, baseURL, setAuthFailureHandler } from "../lib/api";
import { decodeAccessToken } from "../lib/jwt";
import { tokenStore } from "../lib/tokenStore";

type AuthContextValue = {
  user: JwtAccessPayload | null;
  isAuthenticated: boolean;
  setSession: (accessToken: string) => void;
  logout: () => Promise<void>;
  hydrationDone: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<JwtAccessPayload | null>(null);
  const [hydrationDone, setHydrationDone] = useState(false);

  const setSession = useCallback((accessToken: string) => {
    tokenStore.set(accessToken);
    setUser(decodeAccessToken(accessToken));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      /* ignore */
    }
    tokenStore.set(null);
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    setAuthFailureHandler(() => {
      tokenStore.set(null);
      setUser(null);
      navigate("/login", { replace: true });
    });
    return () => setAuthFailureHandler(null);
  }, [navigate]);

  useEffect(() => {
    void (async () => {
      if (tokenStore.get()) {
        const existing = tokenStore.get();
        if (existing) {
          try {
            setUser(decodeAccessToken(existing));
          } catch {
            tokenStore.set(null);
          }
        }
        setHydrationDone(true);
        return;
      }
      try {
        const { data } = await axios.post<{ accessToken: string }>(
          `${baseURL}/api/auth/refresh`,
          {},
          { withCredentials: true },
        );
        setSession(data.accessToken);
      } catch {
        tokenStore.set(null);
      } finally {
        setHydrationDone(true);
      }
    })();
  }, [setSession]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      setSession,
      logout,
      hydrationDone,
    }),
    [user, setSession, logout, hydrationDone],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
