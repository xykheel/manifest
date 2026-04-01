import { Navigate, useLocation } from "react-router-dom";
import { hasOAuthRedirectParams } from "../lib/oauthRedirectParams";

/**
 * If Entra returns the auth response to the wrong path (e.g. /, /login), forward to /auth/callback
 * in the same render cycle so query/hash are not stripped by other redirects.
 * DefaultEntryRedirect also checks hasOAuthRedirectParams — two Navigate components can race; both must preserve OAuth.
 */
export function OAuthRedirectToCallback() {
  const location = useLocation();

  if (location.pathname === "/auth/callback") {
    return null;
  }

  if (hasOAuthRedirectParams(location.search, location.hash)) {
    return (
      <Navigate
        to={{ pathname: "/auth/callback", search: location.search, hash: location.hash }}
        replace
      />
    );
  }

  return null;
}
