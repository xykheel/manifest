import { useMsal } from "@azure/msal-react";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthLoadingScreen } from "../components/AuthLoadingScreen";
import { useAuth } from "../context/AuthContext";
import { useSso } from "../context/SsoContext";
import { api, setSuppressAuthFailure } from "../lib/api";
import { ensureMsalInitialized, loginRequest } from "../lib/msal";

/** MsalProvider runs initialize() + handleRedirectPromise() asynchronously; accounts can appear hundreds of ms later. */
const ACCOUNT_POLL_MS = 150;
const ACCOUNT_WAIT_MS = 20_000;

/** Brief hold on /auth/callback after SSO succeeds so cookies/session state can settle before leaving (avoids race with dashboard). */
const POST_SSO_REDIRECT_DELAY_MS = 9_000;

/**
 * MsalProvider starts handleRedirectPromise() in an effect, but that is async — this route's effect
 * can run before it completes, so getAllAccounts() stays empty and we never POST /api/auth/sso/callback
 * (no refresh cookie). Await handleRedirectPromise() here after initialize(); a second await is a no-op
 * once the response is consumed (MSAL returns null) but guarantees the redirect is processed first.
 */
function AuthCallbackInner() {
  const { instance } = useMsal();
  const { establishSession, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  /** Set after establishSession resolves so success UI does not depend only on context (avoids losing "signed in" if onAuthFailure raced). */
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const completionStarted = useRef(false);

  useEffect(() => {
    setSuppressAuthFailure(true);
    return () => setSuppressAuthFailure(false);
  }, []);

  useEffect(() => {
    if (completionStarted.current) return;
    let cancelled = false;

    void (async () => {
      try {
        await ensureMsalInitialized(instance);
        await instance.handleRedirectPromise();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Microsoft sign-in failed.");
        }
        return;
      }

      const deadline = Date.now() + ACCOUNT_WAIT_MS;
      let account = instance.getAllAccounts()[0];

      while (!account && !cancelled && Date.now() < deadline) {
        await new Promise((r) => window.setTimeout(r, ACCOUNT_POLL_MS));
        account = instance.getAllAccounts()[0];
      }

      if (cancelled) return;
      if (!account) {
        setError("No Microsoft session returned. Try signing in again.");
        return;
      }

      completionStarted.current = true;

      try {
        const tokenResult = await instance.acquireTokenSilent({
          scopes: [...loginRequest.scopes],
          account,
        });

        if (!tokenResult.idToken) {
          if (!cancelled) {
            setError("No Microsoft ID token. Try signing in again.");
            completionStarted.current = false;
          }
          return;
        }

        const { data } = await api.post<{ accessToken: string }>("/api/auth/sso/callback", {
          idToken: tokenResult.idToken,
        });

        if (cancelled) return;
        await establishSession(data.accessToken);
        if (!cancelled) setSessionEstablished(true);
      } catch (e) {
        completionStarted.current = false;
        if (cancelled) return;
        if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === "object") {
          const errBody = e.response.data as { error?: string };
          if (typeof errBody.error === "string") {
            setError(errBody.error);
            return;
          }
        }
        setError(e instanceof Error ? e.message : "Microsoft sign-in failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [instance, establishSession]);

  const readyForDashboard = sessionEstablished || isAuthenticated;

  /** After SSO, wait on this route briefly so auth state and cookies stabilize before /dashboard. */
  useEffect(() => {
    if (!readyForDashboard || location.pathname !== "/auth/callback") return;
    const id = window.setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, POST_SSO_REDIRECT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [readyForDashboard, location.pathname, navigate]);

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-red-700 dark:text-red-400">{error}</p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate("/login", { replace: true })}
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <AuthLoadingScreen
      title={readyForDashboard ? "You're signed in" : "Signing you in with Microsoft"}
      subtitle={
        readyForDashboard
          ? "Finishing up. Redirecting to your dashboard…"
          : "Validating your account. This usually takes a few seconds."
      }
    />
  );
}

export function AuthCallbackPage() {
  const { ssoEnabled, ready } = useSso();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!ssoEnabled) {
      navigate("/login", { replace: true });
    }
  }, [ready, ssoEnabled, navigate]);

  if (!ready || !ssoEnabled) {
    return (
      <AuthLoadingScreen title="Preparing sign-in…" subtitle="Loading Microsoft sign-in settings." />
    );
  }

  return <AuthCallbackInner />;
}
