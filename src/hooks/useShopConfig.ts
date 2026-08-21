import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiPutForm } from '../api/client';
import type { BackendShopConfig, ShopConfigForm } from '../types';

const QUERY_KEY = ['configuracion'] as const;

/** Configuración pública del taller (sin autenticación). */
export function usePublicShopConfig() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'public'],
    queryFn: () => apiGet<BackendShopConfig>('/api/configuracion/public'),
    staleTime: 5 * 60 * 1000,
  });
}

/** Configuración del taller para administradores (requiere rol ADMIN). */
export function useAdminShopConfig() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'admin'],
    queryFn: () => apiGet<BackendShopConfig>('/api/configuracion'),
  });
}

/** Actualiza la configuración del taller. Si `logo` es un File se envía como
 *  multipart/form-data; si es string o null se envía como JSON. */
export function useUpdateShopConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: ShopConfigForm) => {
      if (values.logo instanceof File) {
        const formData = new FormData();
        formData.append('nombreTaller', values.nombreTaller);
        formData.append('logo', values.logo);
        return apiPutForm<BackendShopConfig>('/api/configuracion', formData);
      }

      return apiPut<BackendShopConfig>('/api/configuracion', {
        nombreTaller: values.nombreTaller,
        logo: values.logo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
    },
  });
}
