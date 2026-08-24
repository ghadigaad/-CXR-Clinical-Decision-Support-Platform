import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingState } from '../components/ui/States';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { doctor, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Checking your session" />
      </div>
    );
  }

  if (!doctor) {
    // Remember the destination so sign-in can return the clinician to it.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
