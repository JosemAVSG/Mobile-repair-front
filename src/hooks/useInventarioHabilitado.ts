import { useAuth } from './useAuth';

/**
 * Indica si el plan del taller incluye ventas e inventario (productos VENTA/AMBOS, stock, KPIs).
 * Lee `user.inventarioHabilitado` (login/me). Defensivo: si el backend todavía no lo envía
 * (undefined/null) se asume true para no bloquear a nadie; solo `false` explícito restringe.
 */
export function useInventarioHabilitado(): boolean {
  const { user } = useAuth();
  return user?.inventarioHabilitado !== false;
}
