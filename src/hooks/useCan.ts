import { useAuth } from './useAuth';
import type { ActionPermission, CanResource, RolUsuario } from '../types';

/** Devuelve true si el usuario actual puede realizar la acción o tiene el
 *  rol indicado. Para técnicos, las acciones sobre un recurso requieren que
 *  `resource.tecnicoId` coincida con el técnico logueado. */
export function useCan(
  permission: RolUsuario | ActionPermission,
  resource?: CanResource,
): boolean {
  const { user } = useAuth();

  if (!user) return false;

  // Verificación por rol directo.
  if (permission === 'ADMIN' || permission === 'TECNICO') {
    return user.rol === permission;
  }

  // ADMIN puede todo.
  if (user.rol === 'ADMIN') return true;

  // TECNICO: permisos restringidos por recurso.
  if (user.rol === 'TECNICO') {
    switch (permission) {
      case 'orden:create':
        return true;
      case 'orden:view':
      case 'orden:edit':
      case 'reparacion:manage':
      case 'entrega:manage':
      case 'foto:manage':
        return (
          resource?.tecnicoId != null &&
          resource.tecnicoId === user.tecnicoId
        );
      default:
        return false;
    }
  }

  return false;
}
