import type { AuthSessionResponse, JwtAccessPayload, MeUser } from "@manifest/shared";
import axios from "axios";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  api,
  baseURL,
  clearPostAuthGrace,
  getMeWithToken,
  notifySessionEstablished,
  setAuthFailureHandler,
} from "../lib/api";
import { decodeAccessToken, isAccessTokenValid } from "../lib/jwt";
import { tokenStore } from "../lib/tokenStore";

function meFromJwt(jwt: JwtAccessPayload, departments: MeUser["departments"] = []): MeUser {
  return {
    sub: jwt.sub,
    email: jwt.email,
    firstName: jwt.firstName ?? null,
    lastName: jwt.lastName ?? null,
    role: jwt.role,
    authProvider: jwt.authProvider,
    iat: jwt.iat,
    exp: jwt.exp,
    departments,
  };
}

async function fetchMeIntoSetter(setUser: Dispatch<SetStateAction<MeUser | null>>) {
  const token = tokenStore.get();
  if (!token) return;
  try {
    const { user } = await getMeWithToken(token);
    setUser(user);
  } catch {
    /* keep JWT-derived user; departments may stay empty */
  }
}

export type LogoutOptions = {
  /** Set when Microsoft `logoutRedirect` will perform navigation (avoid double-routing). */
  skipNavigate?: boolean;
};

type AuthContextValue = {
  user: MeUser | null;
  isAuthenticated: boolean;
  setSession: (accessToken: string) => void;
  /** Sets access token, then awaits GET /api/me so the session is fully established before callers navigate. Use for SSO callback. */
  establishSession: (accessToken: string) => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
  hydrationDone: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<MeUser | null>(null);
  const [hydrationDone, setHydrationDone] = useState(false);

  const setSession = useCallback((accessToken: string) => {
    tokenStore.set(accessToken);
    notifySessionEstablished();
    const decoded = decodeAccessToken(accessToken);
    setUser(meFromJwt(decoded, []));
    void fetchMeIntoSetter(setUser);
  }, []);

  const establishSession = useCallback(async (accessToken: string): Promise<void> => {
    flushSync(() => {
      tokenStore.set(accessToken);
      const decoded = decodeAccessToken(accessToken);
      setUser(meFromJwt(decoded, []));
    });
    notifySessionEstablished();
    try {
      const { user } = await getMeWithToken(accessToken);
      flushSync(() => {
        setUser(user);
      });
    } catch {
      /* keep JWT-derived user; departments may stay empty */
    }
  }, []);

  const logout = useCallback(async (options?: LogoutOptions) => {
    clearPostAuthGrace();
    try {
      await api.post("/api/auth/logout");
    } catch {
      try {
        await axios.post(`${baseURL}/api/auth/logout`, {}, { withCredentials: true });
      } catch {
        /* still clear client session */
      }
    }
    tokenStore.set(null);
    setUser(null);
    if (!options?.skipNavigate) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    setAuthFailureHandler(() => {
      clearPostAuthGrace();
      tokenStore.set(null);
      setUser(null);
      navigate("/login", { replace: true });
    });
    return () => setAuthFailureHandler(null);
  }, [navigate]);

  /** Reconcile React state when tokenStore has a valid JWT but user is null (SSO vs hydration / Strict Mode). */
  useLayoutEffect(() => {
    if (user) return;
    const t = tokenStore.get();
    if (!t || !isAccessTokenValid(t)) return;
    try {
      setUser(meFromJwt(decodeAccessToken(t), []));
      void fetchMeIntoSetter(setUser);
    } catch {
      tokenStore.set(null);
    }
  }, [user]);

  useEffect(() => {
    void (async () => {
      if (tokenStore.get()) {
        const existing = tokenStore.get();
        if (existing) {
          try {
            setUser(meFromJwt(decodeAccessToken(existing), []));
            void fetchMeIntoSetter(setUser);
          } catch {
            tokenStore.set(null);
          }
        }
        setHydrationDone(true);
        return;
      }
      try {
        let session: AuthSessionResponse | null = null;
        const pauseBeforeRetryMs = [120, 160, 170, 250] as const;
        for (let attempt = 0; attempt < 5; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, pauseBeforeRetryMs[attempt - 1]!));
          }
          const { data } = await axios.get<AuthSessionResponse>(`${baseURL}/api/auth/session`, {
            withCredentials: true,
          });
          session = data;
          if (data.hasRefreshCookie) break;
        }
        if (!session?.hasRefreshCookie) {
          return;
        }
        const { data } = await axios.post<{ accessToken: string }>(
          `${baseURL}/api/auth/refresh`,
          {},
          { withCredentials: true },
        );
        tokenStore.set(data.accessToken);
        notifySessionEstablished();
        const decoded = decodeAccessToken(data.accessToken);
        setUser(meFromJwt(decoded, []));
        void fetchMeIntoSetter(setUser);
      } catch {
        // Refresh can fail while Microsoft SSO is still completing: the refresh cookie is only set
        // after POST /api/auth/sso/callback. A concurrent boot-time refresh must not wipe an access
        // token that SSO writes to tokenStore a moment later.
        if (!tokenStore.get()) {
          tokenStore.set(null);
        }
      } finally {
        setHydrationDone(true);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      setSession,
      establishSession,
      logout,
      hydrationDone,
    }),
    [user, setSession, establishSession, logout, hydrationDone],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
