import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function PrivateRoute() {
  const { isAuthenticated, hydrationDone } = useAuth();
  const location = useLocation();

  if (!hydrationDone) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-600">Loading…</div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
