import { useQuery } from '@tanstack/react-query';
import { getDashboardResumen } from '../api/dashboard';

/** Resumen de ingresos y métricas de repuestos. `enabled` debe ser false para no-ADMIN (el endpoint da 403). */
export function useDashboardResumen(desde: string | undefined, hasta: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'resumen', desde ?? null, hasta ?? null],
    queryFn: () => getDashboardResumen(desde, hasta),
    enabled,
  });
}
