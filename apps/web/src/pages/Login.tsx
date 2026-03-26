import type { SsoConfigResponse } from "@onboarding/shared";
import { useMsal } from "@azure/msal-react";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSso } from "../context/SsoContext";
import { api, baseURL } from "../lib/api";
import { loginRequest } from "../lib/msal";

function MicrosoftLogo() {
  return (
    <svg aria-hidden className="h-5 w-5 shrink-0" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <path fill="#f25022" d="M0 0h10v10H0z" />
      <path fill="#00a4ef" d="M11 0h10v10H11z" />
      <path fill="#7fba00" d="M0 11h10v10H0z" />
      <path fill="#ffb900" d="M11 11h10v10H11z" />
    </svg>
  );
}

function MicrosoftSignInButton({
  configReady,
  configError,
}: {
  configReady: boolean;
  configError: boolean;
}) {
  const { instance } = useMsal();
  const [msLoading, setMsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onMicrosoft() {
    setMsLoading(true);
    setError(null);
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microsoft sign-in failed.");
      setMsLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-sm transition enabled:hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "#2F2F2F" }}
        onClick={onMicrosoft}
        disabled={msLoading || !configReady || configError}
      >
        <MicrosoftLogo />
        {msLoading ? "Redirecting…" : "Sign in with Microsoft"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </>
  );
}

export function LoginPage() {
  const { ssoEnabled } = useSso();
  const { setSession, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [localConfig, setLocalConfig] = useState<SsoConfigResponse | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await axios.get<SsoConfigResponse>(`${baseURL}/api/auth/sso/config`, {
          withCredentials: true,
        });
        setLocalConfig(data);
      } catch {
        setConfigError("Could not load sign-in options.");
      }
    })();
  }, []);

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email";
    if (!password) next.password = "Password is required";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post<{ accessToken: string }>("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      setSession(data.accessToken);
      navigate("/dashboard", { replace: true });
    } catch {
      setFormError("Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  const showSso = ssoEnabled && localConfig?.ssoEnabled === true;
  const configReady = Boolean(localConfig);

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200/80">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-2 text-center text-sm text-slate-600">Onboarding platform</p>

        {configError && (
          <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{configError}</p>
        )}

        <div className="mt-8 space-y-6">
          {showSso && (
            <>
              <MicrosoftSignInButton configReady={configReady} configError={Boolean(configError)} />

              <div className="relative">
                <div aria-hidden className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-500">or continue with email</span>
                </div>
              </div>
            </>
          )}

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none ring-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none ring-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50"
              />
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {formError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting || Boolean(configError)}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
