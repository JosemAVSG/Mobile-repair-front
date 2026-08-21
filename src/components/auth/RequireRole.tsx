import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { RequireRoleProps } from '../../types';

/** Requiere que el usuario esté autenticado y tenga uno de los roles
 *  indicados. Si no cumple, redirige a `fallback` (por defecto /reparaciones).
 *  Si no está autenticado, redirige a /login. */
export function RequireRole({
  roles,
  fallback = '/reparaciones',
  children,
}: RequireRoleProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.rol)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
