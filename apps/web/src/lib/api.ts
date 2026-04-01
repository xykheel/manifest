import type { MeUser } from "@manifest/shared";
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { isAccessTokenValid } from "./jwt";
import { tokenStore } from "./tokenStore";

/**
 * Dev: empty string → requests stay on the Vite origin; `vite.config` proxies `/api` to the backend so
 * the httpOnly refresh cookie (`refresh_token`) is set for the app origin (e.g. localhost:5173), not
 * for the API port — check Cookies for the URL in the address bar, not Local/Session Storage.
 * Prod: set `VITE_API_URL` if the API is on another origin; omit or leave empty if nginx serves `/api` on the same host.
 */
const baseURL = import.meta.env.DEV
  ? ""
  : import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

/**
 * GET /api/me with a known Bearer token, without the global 401 interceptor (no refresh → onAuthFailure).
 * Use when establishing a session (SSO/email): a transient 401 or missing refresh cookie must not wipe the new login.
 */
export async function getMeWithToken(accessToken: string): Promise<{ user: MeUser }> {
  const { data } = await axios.get<{ user: MeUser }>(`${baseURL}/api/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    withCredentials: true,
  });
  return data;
}

let refreshPromise: Promise<string | null> | null = null;
let onAuthFailure: (() => void) | null = null;

/** When true, 401 + failed refresh does not clear the session or navigate to /login (SSO callback race). */
let suppressAuthFailure = false;

/**
 * After login/refresh, failed refresh must not navigate to /login until the browser reliably sends the
 * refresh cookie (AuthCallback unmount clears suppressAuthFailure before /dashboard requests run).
 */
let postAuthGraceUntil = 0;
const POST_AUTH_GRACE_MS = 45_000;

export function notifySessionEstablished(): void {
  postAuthGraceUntil = Date.now() + POST_AUTH_GRACE_MS;
}

export function clearPostAuthGrace(): void {
  postAuthGraceUntil = 0;
}

export function setAuthFailureHandler(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

export function setSuppressAuthFailure(suppress: boolean): void {
  suppressAuthFailure = suppress;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ accessToken: string }>(`${baseURL}/api/auth/refresh`, {}, { withCredentials: true })
      .then((r) => r.data.accessToken)
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (!original || original._retry) {
      return Promise.reject(error);
    }
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }
    const path = original.url ?? "";
    if (
      path.includes("/api/auth/login") ||
      path.includes("/api/auth/refresh") ||
      path.includes("/api/auth/sso/callback")
    ) {
      return Promise.reject(error);
    }

    original._retry = true;
    let next = await refreshAccessToken();
    if (!next) {
      await new Promise((r) => setTimeout(r, 200));
      next = await refreshAccessToken();
    }
    if (!next) {
      const stored = tokenStore.get();
      if (stored && isAccessTokenValid(stored)) {
        return Promise.reject(error);
      }
      if (suppressAuthFailure || Date.now() < postAuthGraceUntil) {
        return Promise.reject(error);
      }
      tokenStore.set(null);
      onAuthFailure?.();
      return Promise.reject(error);
    }
    tokenStore.set(next);
    original.headers.Authorization = `Bearer ${next}`;
    return api(original);
  },
);

export { baseURL };
