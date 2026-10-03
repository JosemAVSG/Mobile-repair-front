import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConfig, updateConfig } from '../api/configuracion';
import type { ShopConfigForm } from '../types';

const QUERY_KEY = ['configuracion'] as const;

/** Configuración del taller para administradores (requiere rol ADMIN). */
export function useAdminShopConfig() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'admin'],
    queryFn: () => getConfig(),
  });
}

/** Actualiza la configuración del taller. Si `logo` es un File se envía como
 *  multipart/form-data; si es string o null se envía como JSON. */
export function useUpdateShopConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ShopConfigForm) => updateConfig(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
    },
  });
}