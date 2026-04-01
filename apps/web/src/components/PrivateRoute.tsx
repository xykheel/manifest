import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthLoadingScreen } from "./AuthLoadingScreen";
import { useAuth } from "../context/AuthContext";
import { isAccessTokenValid } from "../lib/jwt";
import { tokenStore } from "../lib/tokenStore";

export function PrivateRoute() {
  const { isAuthenticated, hydrationDone } = useAuth();
  const location = useLocation();

  if (!hydrationDone) {
    return (
      <AuthLoadingScreen title="Checking your session…" subtitle="Restoring your sign-in if you were already logged in." />
    );
  }

  const stored = tokenStore.get();
  const hasValidJwt = Boolean(stored && isAccessTokenValid(stored));

  if (!isAuthenticated && !hasValidJwt) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAuthenticated && hasValidJwt) {
    return (
      <AuthLoadingScreen title="Almost there…" subtitle="Finishing sign-in." />
    );
  }

  return <Outlet />;
}
