import { Navigate, useLocation } from "react-router-dom";
import { AuthLoadingScreen } from "./AuthLoadingScreen";
import { useAuth } from "../context/AuthContext";
import { hasOAuthRedirectParams } from "../lib/oauthRedirectParams";
import { isAccessTokenValid } from "../lib/jwt";
import { tokenStore } from "../lib/tokenStore";

/**
 * Root and catch-all entry: do not send anonymous users to /dashboard (they get bounced to /login
 * and flash the login page). Send them straight to /login; authenticated users go to /dashboard.
 *
 * If Entra (or a misconfigured redirect URI) returns OAuth params on / or an unknown path, we must
 * send them to /auth/callback before /login — otherwise we race with OAuthRedirectToCallback and can
 * Navigate to /login without the query string, dropping `code` and looking like instant logout.
 */
export function DefaultEntryRedirect() {
  const location = useLocation();
  const { isAuthenticated, hydrationDone } = useAuth();

  if (!hydrationDone) {
    return (
      <AuthLoadingScreen title="Loading…" subtitle="Starting the app." />
    );
  }

  if (hasOAuthRedirectParams(location.search, location.hash)) {
    return (
      <Navigate
        to={{ pathname: "/auth/callback", search: location.search, hash: location.hash }}
        replace
      />
    );
  }

  const stored = tokenStore.get();
  const hasValidJwt = Boolean(stored && isAccessTokenValid(stored));

  if (isAuthenticated || hasValidJwt) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}
