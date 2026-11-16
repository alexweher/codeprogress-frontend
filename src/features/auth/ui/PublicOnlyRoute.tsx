import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../model/useAuth';

function getAuthenticatedRedirect(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'from' in value &&
    typeof value.from === 'string' &&
    value.from.startsWith('/app/')
  ) {
    return value.from;
  }

  return '/app/dashboard';
}

export function PublicOnlyRoute({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to={getAuthenticatedRedirect(location.state)} replace />;
  }

  return children;
}
