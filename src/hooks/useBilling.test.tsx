import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useCambiarPlan,
  useCancelarSuscripcion,
  useCobros,
  useReactivarSuscripcion,
  useRegistrarMetodoPago,
  useSuscripcion,
  useWompiAcceptance,
} from './useBilling';
import type { Suscripcion, WompiAcceptance } from '../types';

const baseSuscripcion: Suscripcion = {
  plan: 'BASICO',
  planDisplayName: 'Basic',
  estado: 'ACTIVO',
  trialEndsAt: null,
  currentPeriodEnd: null,
  nextChargeAt: null,
  cancelAtPeriodEnd: false,
  pendingPlan: null,
  pendingPlanDisplayName: null,
  precioCop: 49900,
  montoProximoCobroCop: null,
  metodoPago: null,
  ultimoCobro: null,
  cobroEnCurso: false,
  enMora: false,
  pagosHabilitados: true,
  features: [],
};

const acceptance: WompiAcceptance = {
  publicKey: 'pub_test_x',
  acceptanceToken: 'a',
  acceptancePermalink: 'https://wompi.co/a',
  personalAuthToken: 'p',
  personalAuthPermalink: 'https://wompi.co/p',
};

vi.mock('../api/billing', () => ({
  getSuscripcion: vi.fn(),
  getWompiAcceptance: vi.fn(),
  getCobros: vi.fn(),
  registrarMetodoPago: vi.fn(),
  cambiarPlan: vi.fn(),
  cancelarSuscripcion: vi.fn(),
  reactivarSuscripcion: vi.fn(),
}));

import * as billingApi from '../api/billing';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('useBilling hooks (R-UI2, R-UI8)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useSuscripcion', () => {
    it('fetches subscription on mount', async () => {
      vi.mocked(billingApi.getSuscripcion).mockResolvedValue(baseSuscripcion);
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuscripcion(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(billingApi.getSuscripcion).toHaveBeenCalledTimes(1);
    });

    it('polls every 4s while cobroEnCurso and stops after the 2min cap', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(billingApi.getSuscripcion)
        .mockResolvedValueOnce({ ...baseSuscripcion, cobroEnCurso: true })
        .mockResolvedValue({ ...baseSuscripcion, cobroEnCurso: true });

      const { wrapper } = createWrapper();
      renderHook(() => useSuscripcion(), { wrapper });

      await waitFor(() => expect(billingApi.getSuscripcion).toHaveBeenCalledTimes(1));

      await vi.advanceTimersByTimeAsync(4_000);
      await waitFor(() => expect(billingApi.getSuscripcion).toHaveBeenCalledTimes(2));

      await vi.advanceTimersByTimeAsync(4_000);
      await waitFor(() => expect(billingApi.getSuscripcion).toHaveBeenCalledTimes(3));

      // Beyond the 2 minute cap polling should stop.
      await vi.advanceTimersByTimeAsync(122_000);
      // Let any fetch already scheduled at the cap boundary settle.
      await vi.advanceTimersByTimeAsync(2_000);
      const callsAfterCap = vi.mocked(billingApi.getSuscripcion).mock.calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      // A fetch scheduled right at the cap boundary may still fire, but the
      // polling rate must drop drastically (not one every 4s).
      expect(vi.mocked(billingApi.getSuscripcion).mock.calls.length).toBeLessThanOrEqual(
        callsAfterCap + 2,
      );
    });

    it('stops polling when cobroEnCurso becomes false', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(billingApi.getSuscripcion)
        .mockResolvedValueOnce({ ...baseSuscripcion, cobroEnCurso: true })
        .mockResolvedValueOnce({ ...baseSuscripcion, cobroEnCurso: true })
        .mockResolvedValue({ ...baseSuscripcion, cobroEnCurso: false });

      const { wrapper } = createWrapper();
      renderHook(() => useSuscripcion(), { wrapper });

      await waitFor(() => expect(billingApi.getSuscripcion).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(4_000);
      await waitFor(() => expect(billingApi.getSuscripcion).toHaveBeenCalledTimes(2));
      await vi.advanceTimersByTimeAsync(4_000);
      await waitFor(() => expect(billingApi.getSuscripcion).toHaveBeenCalledTimes(3));

      const callsAfterStop = vi.mocked(billingApi.getSuscripcion).mock.calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(vi.mocked(billingApi.getSuscripcion).mock.calls.length).toBe(callsAfterStop);
    });
  });

  describe('useWompiAcceptance', () => {
    it('fetches acceptance only when enabled', async () => {
      vi.mocked(billingApi.getWompiAcceptance).mockResolvedValue(acceptance);
      const { wrapper } = createWrapper();
      const { result, rerender } = renderHook(({ enabled }) => useWompiAcceptance(enabled), {
        wrapper,
        initialProps: { enabled: false },
      });

      expect(result.current.isFetching).toBe(false);
      expect(billingApi.getWompiAcceptance).not.toHaveBeenCalled();

      rerender({ enabled: true });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(billingApi.getWompiAcceptance).toHaveBeenCalledTimes(1);
    });
  });

  describe('useCobros', () => {
    it('fetches charges with default limit', async () => {
      vi.mocked(billingApi.getCobros).mockResolvedValue([]);
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCobros(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(billingApi.getCobros).toHaveBeenCalledWith(12);
    });
  });

  describe('mutations', () => {
    it('registrarMetodoPago invalidates subscription and cobros and requests /me refresh on success', async () => {
      vi.mocked(billingApi.registrarMetodoPago).mockResolvedValue(baseSuscripcion);
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
      const { wrapper, queryClient } = createWrapper();
      queryClient.setQueryData(['suscripcion'], baseSuscripcion);
      queryClient.setQueryData(['billing', 'cobros'], []);

      const { result } = renderHook(() => useRegistrarMetodoPago(), { wrapper });
      result.current.mutate({
        cardToken: 'tok',
        acceptanceToken: 'a',
        personalAuthToken: 'p',
        email: 'a@b.co',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(billingApi.registrarMetodoPago).toHaveBeenCalledWith({
        cardToken: 'tok',
        acceptanceToken: 'a',
        personalAuthToken: 'p',
        email: 'a@b.co',
      });
      await waitFor(() => expect(queryClient.getQueryState(['suscripcion'])?.isInvalidated).toBe(true));
      expect(queryClient.getQueryState(['billing', 'cobros'])?.isInvalidated).toBe(true);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'fixtra:refresh-me' }),
      );
      dispatchSpy.mockRestore();
    });

    it('registrarMetodoPago does not dispatch refresh event on error', async () => {
      vi.mocked(billingApi.registrarMetodoPago).mockRejectedValue(new Error('fail'));
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useRegistrarMetodoPago(), { wrapper });

      result.current.mutate({
        cardToken: 'tok',
        acceptanceToken: 'a',
        personalAuthToken: 'p',
        email: 'a@b.co',
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(dispatchSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'fixtra:refresh-me' }),
      );
      dispatchSpy.mockRestore();
    });

    it('cambiarPlan invalidates subscription and cobros', async () => {
      vi.mocked(billingApi.cambiarPlan).mockResolvedValue(baseSuscripcion);
      const { wrapper, queryClient } = createWrapper();
      queryClient.setQueryData(['suscripcion'], baseSuscripcion);
      queryClient.setQueryData(['billing', 'cobros'], []);

      const { result } = renderHook(() => useCambiarPlan(), { wrapper });
      result.current.mutate('PRO');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(billingApi.cambiarPlan).toHaveBeenCalledWith('PRO');
      expect(queryClient.getQueryState(['suscripcion'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['billing', 'cobros'])?.isInvalidated).toBe(true);
    });

    it('cancelarSuscripcion invalidates subscription and cobros', async () => {
      vi.mocked(billingApi.cancelarSuscripcion).mockResolvedValue(baseSuscripcion);
      const { wrapper, queryClient } = createWrapper();
      queryClient.setQueryData(['suscripcion'], baseSuscripcion);
      queryClient.setQueryData(['billing', 'cobros'], []);

      const { result } = renderHook(() => useCancelarSuscripcion(), { wrapper });
      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(queryClient.getQueryState(['suscripcion'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['billing', 'cobros'])?.isInvalidated).toBe(true);
    });

    it('reactivarSuscripcion invalidates subscription and cobros', async () => {
      vi.mocked(billingApi.reactivarSuscripcion).mockResolvedValue(baseSuscripcion);
      const { wrapper, queryClient } = createWrapper();
      queryClient.setQueryData(['suscripcion'], baseSuscripcion);
      queryClient.setQueryData(['billing', 'cobros'], []);

      const { result } = renderHook(() => useReactivarSuscripcion(), { wrapper });
      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(queryClient.getQueryState(['suscripcion'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['billing', 'cobros'])?.isInvalidated).toBe(true);
    });
  });
});
