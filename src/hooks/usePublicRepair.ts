import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/ApiClient';
import { getPublicRepairStatus } from '../api/ordenes';
import type { PublicRepairStatus } from '../types';

const QUERY_KEY = ['ordenes', 'public'] as const;

/**
 * Consulta pública el estado de una reparación por ID.
 * No requiere autenticación. No reintenta 404s (orden desconocida).
 */
export function usePublicRepair(id: string | undefined) {
  return useQuery<PublicRepairStatus, ApiError>({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => getPublicRepairStatus(id!),
    enabled: Boolean(id),
    retry: (failureCount, error) => {
      // Una orden inexistente no va a aparecer reintentando.
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}