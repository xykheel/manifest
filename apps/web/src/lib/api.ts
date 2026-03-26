import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStore } from "./tokenStore";

const baseURL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;
let onAuthFailure: (() => void) | null = null;

export function setAuthFailureHandler(handler: (() => void) | null): void {
  onAuthFailure = handler;
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
    if (path.includes("/api/auth/login") || path.includes("/api/auth/refresh")) {
      return Promise.reject(error);
    }

    original._retry = true;
    const next = await refreshAccessToken();
    if (!next) {
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
