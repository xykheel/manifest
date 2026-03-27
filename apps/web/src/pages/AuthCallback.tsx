import { InteractionStatus } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSso } from "../context/SsoContext";
import { api } from "../lib/api";
import { loginRequest } from "../lib/msal";

/**
 * MsalProvider already runs initialize() + handleRedirectPromise() on mount.
 * Calling handleRedirectPromise() here races that work (child effects can run first) and a second
 * call often returns null after the redirect response was consumed — leaving no id token.
 * After inProgress settles, read the signed-in account and get an id token from cache / silent renewal.
 */
function AuthCallbackInner() {
  const { instance, inProgress, accounts } = useMsal();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const completionStarted = useRef(false);

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;

    const account = accounts[0] ?? instance.getAllAccounts()[0];
    if (!account) {
      return;
    }

    if (completionStarted.current) return;
    completionStarted.current = true;

    let cancelled = false;

    void (async () => {
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
        flushSync(() => {
          setSession(data.accessToken);
        });
        navigate("/dashboard", { replace: true });
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
  }, [inProgress, accounts, instance, navigate, setSession]);

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;
    if (accounts.length > 0 || instance.getAllAccounts().length > 0) return;

    const t = window.setTimeout(() => {
      if (instance.getAllAccounts().length === 0) {
        setError("No Microsoft session returned. Try signing in again.");
      }
    }, 1500);

    return () => window.clearTimeout(t);
  }, [inProgress, accounts, instance]);

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
    <div className="flex min-h-full items-center justify-center text-slate-500 dark:text-slate-400">
      Completing Microsoft sign-in…
    </div>
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
      <div className="flex min-h-full items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  return <AuthCallbackInner />;
}
