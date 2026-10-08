import { ApiClient } from './ApiClient';
import type { DashboardResumen } from '../types';

/** GET /api/dashboard/resumen (ADMIN). `desde`/`hasta` yyyy-MM-dd, ambos opcionales (hasta inclusive). */
export const getDashboardResumen = async (
  desde?: string,
  hasta?: string,
): Promise<DashboardResumen> => {
  const params = new URLSearchParams();
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  const qs = params.toString();
  return ApiClient.get<DashboardResumen>(
    qs ? `/api/dashboard/resumen?${qs}` : '/api/dashboard/resumen',
  );
};
