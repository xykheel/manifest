import { InteractionStatus } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLoadingScreen } from "../components/AuthLoadingScreen";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useSso } from "../context/SsoContext";
import { api } from "../lib/api";
import { isAccessTokenValid } from "../lib/jwt";
import { tokenStore } from "../lib/tokenStore";
import { clearMsalBrowserState, ensureMsalInitialized, loginRequest } from "../lib/msal";

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
  const { instance, inProgress } = useMsal();
  const [msLoading, setMsLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const msalBusy = inProgress !== InteractionStatus.None;
  const buttonDisabled = msLoading || resetting || msalBusy;

  async function onMicrosoft() {
    setMsLoading(true);
    setError(null);
    setResetMessage(null);
    try {
      await ensureMsalInitialized(instance);
      /**
       * MsalProvider also awaits this on mount; calling again returns the same result immediately.
       * MSAL requires this to settle before loginRedirect or the first click can hit interaction_in_progress / ignored redirect.
       */
      await instance.handleRedirectPromise();
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microsoft sign-in failed.");
      setMsLoading(false);
    }
  }

  async function onClearMicrosoftCache() {
    setResetting(true);
    setError(null);
    setResetMessage(null);
    try {
      await ensureMsalInitialized(instance);
      await clearMsalBrowserState(instance);
      setResetMessage(
        "Microsoft sign-in data for this browser tab was cleared. Wait a minute if Microsoft was rate-limiting you, then try Sign in again.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear Microsoft sign-in data.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80"
        onClick={onMicrosoft}
        disabled={buttonDisabled}
      >
        {msLoading ? (
          <span
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-brand dark:border-slate-500 dark:border-t-brand"
            aria-hidden
          />
        ) : (
          <MicrosoftLogo />
        )}
        {msLoading ? "Redirecting to Microsoft…" : "Sign in with Microsoft"}
      </button>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        {`If Microsoft shows "couldn't sign you in" or too many attempts, wait a few minutes, then `}
        <button
          type="button"
          className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
          onClick={() => void onClearMicrosoftCache()}
          disabled={buttonDisabled}
        >
          clear Microsoft data for this site
        </button>{" "}
        and try again.
      </p>
      {resetting && <p className="text-center text-sm text-slate-500 dark:text-slate-400">Clearing…</p>}
      {resetMessage && <p className="text-center text-sm text-slate-600 dark:text-slate-300">{resetMessage}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </>
  );
}

/** While MSAL is still processing (e.g. redirect return landed on /login briefly), show the same full-page loader as /auth/callback. */
function LoginSsoLoadingGate({ children }: { children: React.ReactNode }) {
  const { inProgress } = useMsal();
  if (inProgress !== InteractionStatus.None) {
    return (
      <AuthLoadingScreen
        title="Signing you in with Microsoft"
        subtitle="Validating your account. This can take a few seconds—please don’t close this tab."
      />
    );
  }
  return <>{children}</>;
}

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}

export function LoginPage() {
  const { ssoEnabled, ready: ssoReady } = useSso();
  const { setSession, isAuthenticated, hydrationDone } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hydrationDone) return;
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
      return;
    }
    const t = tokenStore.get();
    if (t && isAccessTokenValid(t)) {
      navigate("/dashboard", { replace: true });
    }
  }, [hydrationDone, isAuthenticated, navigate]);

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

  if (!hydrationDone) {
    return (
      <LoginShell>
        <AuthLoadingScreen title="Checking your session…" subtitle="Hang tight." />
      </LoginShell>
    );
  }

  const form = (
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
  );

  return (
    <LoginShell>
      {showSso ? <LoginSsoLoadingGate>{form}</LoginSsoLoadingGate> : form}
    </LoginShell>
  );
}
