import { useMsal } from "@azure/msal-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSso } from "../context/SsoContext";
import { api } from "../lib/api";

function AuthCallbackInner() {
  const { instance } = useMsal();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await instance.handleRedirectPromise();
        if (!result?.idToken) {
          setError("No Microsoft session returned. Try signing in again.");
          return;
        }
        const { data } = await api.post<{ accessToken: string }>("/api/auth/sso/callback", {
          idToken: result.idToken,
        });
        setSession(data.accessToken);
        navigate("/dashboard", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Microsoft sign-in failed.");
      }
    })();
  }, [instance, navigate, setSession]);

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
