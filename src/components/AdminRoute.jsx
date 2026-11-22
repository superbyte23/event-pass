import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { ForbiddenPage } from "@/components/ErrorPage";

// Guards admin-only routes. Requires an authenticated admin user.
export default function AdminRoute({ unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, user } = useAuth();
  const location = useLocation();

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return unauthenticatedElement || <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (user?.role !== "admin") {
    return <ForbiddenPage description="You need an admin account to view this area. Sign in with an admin account or head back to the event list." />;
  }

  return <Outlet />;
}
