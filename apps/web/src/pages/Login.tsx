import { useMsal } from "@azure/msal-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useSso } from "../context/SsoContext";
import { api } from "../lib/api";
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

function MicrosoftSignInButton() {
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
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80"
        onClick={onMicrosoft}
        disabled={msLoading}
      >
        <MicrosoftLogo />
        {msLoading ? "Redirecting…" : "Sign in with Microsoft"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </>
  );
}

export function LoginPage() {
  const { ssoEnabled, ready: ssoReady } = useSso();
  const { setSession, isAuthenticated } = useAuth();
  const navigate = useNavigate();

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

  /** SSO UI matches AppShell: MSAL is only mounted when the API reports Entra tenant + client ID. */
  const showSso = ssoEnabled && ssoReady;

  return (
    <div className="relative flex min-h-full items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="card-surface w-full max-w-md p-8 sm:p-10">
        <h1 className="text-center text-3xl font-medium tracking-tight text-slate-800 dark:text-slate-100">
          Sign in
        </h1>
        <p className="mt-3 text-center text-lg text-brand">Manifest</p>

        <div className="mt-8 space-y-6">
          {showSso && (
            <>
              <MicrosoftSignInButton />

              <div className="relative">
                <div aria-hidden className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-inherit px-3 text-slate-500 dark:text-slate-400">
                    or continue with email
                  </span>
                </div>
              </div>
            </>
          )}

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label htmlFor="email" className="block text-base font-medium text-slate-600 dark:text-slate-300">
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
                className="input-field mt-1 block"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-base font-medium text-slate-600 dark:text-slate-300">
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
                className="input-field mt-1 block"
              />
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {formError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {formError}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
