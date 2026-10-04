import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  cancelarSuscripcion,
  cambiarPlan,
  getCobros,
  getPlanes,
  getSuscripcion,
  getWompiAcceptance,
  reactivarSuscripcion,
  registrarMetodoPago,
} from '../api/billing';
import { POLL_CAP_MS } from './useCobroEnCursoWatch';
import { PLANES_FALLBACK } from '../lib/planesFallback';
import type { Cobro, PlanCatalogo, MetodoPagoRequest, PlanSuscripcion, Suscripcion, WompiAcceptance } from '../types';

const POLL_INTERVAL_MS = 4_000;

let pollingAnchor: number | null = null;

function startPolling() {
  pollingAnchor = Date.now();
}

function stopPolling() {
  pollingAnchor = null;
}

function shouldPoll(data: Suscripcion | undefined): number | false {
  if (!data?.cobroEnCurso) {
    stopPolling();
    return false;
  }
  if (pollingAnchor == null) {
    pollingAnchor = Date.now();
  }
  if (Date.now() - pollingAnchor > POLL_CAP_MS) {
    stopPolling();
    return false;
  }
  return POLL_INTERVAL_MS;
}

function dispatchRefreshMe() {
  try {
    window.dispatchEvent(new CustomEvent('fixtra:refresh-me'));
  } catch {
    // ignore environments without CustomEvent
  }
}

export function useSuscripcion(): UseQueryResult<Suscripcion, Error> {
  return useQuery({
    queryKey: ['suscripcion'],
    queryFn: getSuscripcion,
    refetchInterval: (query) => shouldPoll(query.state.data),
  });
}

/** Catálogo público de planes; si el API falla se usa el respaldo local. */
export function usePlanes(): { data: PlanCatalogo[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'planes'],
    queryFn: getPlanes,
    staleTime: 5 * 60_000,
  });
  return { data: data && data.length > 0 ? data : PLANES_FALLBACK, isLoading };
}

export function useWompiAcceptance(enabled: boolean): UseQueryResult<WompiAcceptance, Error> {
  return useQuery({
    queryKey: ['billing', 'acceptance'],
    queryFn: getWompiAcceptance,
    staleTime: 0,
    enabled,
  });
}

export function useCobros(limit = 12, enabled = true): UseQueryResult<Cobro[], Error> {
  return useQuery({
    queryKey: ['billing', 'cobros'],
    queryFn: () => getCobros(limit),
    enabled,
  });
}

export function useRegistrarMetodoPago() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: MetodoPagoRequest) => registrarMetodoPago(req),
    onSuccess: () => {
      startPolling();
      queryClient.invalidateQueries({ queryKey: ['suscripcion'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'cobros'] });
      dispatchRefreshMe();
    },
  });
}

export function useCambiarPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plan: PlanSuscripcion) => cambiarPlan(plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suscripcion'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'cobros'] });
    },
  });
}

export function useCancelarSuscripcion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelarSuscripcion(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suscripcion'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'cobros'] });
    },
  });
}

export function useReactivarSuscripcion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reactivarSuscripcion(),
    onSuccess: () => {
      startPolling();
      queryClient.invalidateQueries({ queryKey: ['suscripcion'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'cobros'] });
      dispatchRefreshMe();
    },
  });
}
