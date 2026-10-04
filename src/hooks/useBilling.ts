import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCheckout,
  getPortalLink,
  getSuscripcion,
} from '../api/billing';

export function useSuscripcion() {
  return useQuery({
    queryKey: ['suscripcion'],
    queryFn: getSuscripcion,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (plan?: 'BASICO' | 'PRO') => createCheckout(plan),
  });
}

export function usePortalLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getPortalLink(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suscripcion'] });
    },
  });
}
