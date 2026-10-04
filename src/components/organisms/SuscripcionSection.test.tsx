import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PLANES_FALLBACK as PLANES } from '../../lib/planesFallback';
import type { ReactNode } from 'react';
import { SuscripcionSection } from './SuscripcionSection';
import type { Suscripcion } from '../../types';

const baseSuscripcion: Suscripcion = {
  plan: 'BASICO',
  planDisplayName: 'Basic',
  estado: 'ACTIVO',
  trialEndsAt: null,
  currentPeriodEnd: '2026-12-01T00:00:00',
  nextChargeAt: '2026-12-01T00:00:00',
  cancelAtPeriodEnd: false,
  pendingPlan: null,
  pendingPlanDisplayName: null,
  precioCop: 49900,
  montoProximoCobroCop: 49900,
  metodoPago: { brand: 'VISA', last4: '4242' },
  ultimoCobro: null,
  cobroEnCurso: false,
  enMora: false,
  pagosHabilitados: true,
  features: ['Up to 2 technicians'],
};

const useCobrosMock = vi.fn();
let suscripcionQuery: { data?: Suscripcion; isLoading: boolean } = { isLoading: true };
let cambiarPlanMutation = { mutate: vi.fn(), isPending: false };
let cancelarMutation = { mutate: vi.fn(), isPending: false };
let reactivarMutation = { mutate: vi.fn(), isPending: false };

vi.mock('../../hooks/useBilling', () => ({
  usePlanes: () => ({ data: PLANES, isLoading: false }),
  useSuscripcion: () => suscripcionQuery,
  useCambiarPlan: () => cambiarPlanMutation,
  useCancelarSuscripcion: () => cancelarMutation,
  useReactivarSuscripcion: () => reactivarMutation,
  useCobros: (...args: unknown[]) => {
    useCobrosMock(...args);
    return { data: [] };
  },
}));

vi.mock('./MetodoPagoFlow', () => ({
  MetodoPagoFlow: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Método de pago">
        <button onClick={onClose}>Cerrar flujo de pago</button>
      </div>
    ) : null,
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const renderSection = (s: Suscripcion) => {
  suscripcionQuery = { data: s, isLoading: false };
  return render(<SuscripcionSection />, { wrapper: createWrapper() });
};

describe('SuscripcionSection', () => {
  beforeEach(() => {
    useCobrosMock.mockClear();
    suscripcionQuery = { isLoading: true };
    cambiarPlanMutation = { mutate: vi.fn(), isPending: false };
    cancelarMutation = { mutate: vi.fn(), isPending: false };
    reactivarMutation = { mutate: vi.fn(), isPending: false };
  });

  it('shows a spinner while loading', () => {
    render(<SuscripcionSection />, { wrapper: createWrapper() });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows "online payments coming soon" when pagosHabilitados is false', () => {
    renderSection({ ...baseSuscripcion, pagosHabilitados: false });
    expect(screen.getByText(/pagos en línea estarán disponibles pronto/i)).toBeInTheDocument();
  });

  it('shows legacy plan badge only for LEGACY', () => {
    renderSection({ ...baseSuscripcion, plan: 'LEGACY', planDisplayName: 'Legacy' });
    expect(screen.getByText(/plan heredado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('TRIAL without card: countdown, add card button and plan choice', () => {
    const trialEndsAt = new Date(Date.now() + 4.5 * 86_400_000).toISOString();
    renderSection({
      ...baseSuscripcion,
      plan: 'TRIAL',
      planDisplayName: 'Free trial',
      estado: 'TRIAL',
      trialEndsAt,
      precioCop: null,
      montoProximoCobroCop: null,
      metodoPago: null,
    });

    expect(screen.getByText(/de tu prueba gratuita/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar tarjeta/i })).toBeInTheDocument();
    expect(screen.getByText(/se te cobrará el/i)).toBeInTheDocument();
  });

  it('ACTIVO: shows card on file, next charge amount and date, and history', () => {
    renderSection(baseSuscripcion);

    expect(screen.getByText(/VISA •••• 4242/i)).toBeInTheDocument();
    const nextCharge = screen.getByText(/próximo cobro/i);
    expect(nextCharge).toHaveTextContent(/01\/12\/2026/);
    expect(nextCharge).toHaveTextContent(/\$\s?49\.900/);
  });

  it('shows pending plan with applies-from date', () => {
    renderSection({
      ...baseSuscripcion,
      pendingPlan: 'PRO',
      pendingPlanDisplayName: 'Pro',
    });
    expect(screen.getByText(/pro se aplica desde/i)).toBeInTheDocument();
  });

  it('shows cancel notice and calls reactivar when undo is clicked', () => {
    renderSection({ ...baseSuscripcion, cancelAtPeriodEnd: true });
    expect(screen.getByText(/se cancelará el/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /deshacer cancelación/i }));
    expect(reactivarMutation.mutate).toHaveBeenCalled();
  });

  it('opens a confirmation dialog before cancelling', () => {
    renderSection(baseSuscripcion);
    fireEvent.click(screen.getByRole('button', { name: /cancelar suscripción/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(cancelarMutation.mutate).toHaveBeenCalled();
  });

  it('SUSPENDIDO: offers update card and pay, hides plan/cancel actions', () => {
    renderSection({ ...baseSuscripcion, estado: 'SUSPENDIDO' });
    expect(screen.getByRole('button', { name: /actualizar tarjeta y pagar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar suscripción/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cambiar plan/i })).not.toBeInTheDocument();
  });

  it('CANCELADO: offers reactivate with card', () => {
    renderSection({ ...baseSuscripcion, estado: 'CANCELADO' });
    expect(screen.getByRole('button', { name: /reactivar con tarjeta/i })).toBeInTheDocument();
  });

  it('PENDING: shows "payment in process"', () => {
    renderSection({ ...baseSuscripcion, cobroEnCurso: true });
    expect(screen.getByText(/pago en proceso/i)).toBeInTheDocument();
  });

  it('enMora: shows retry warning', () => {
    renderSection({ ...baseSuscripcion, enMora: true, nextChargeAt: '2026-12-02T00:00:00' });
    expect(screen.getByText(/reintentaremos el/i)).toBeInTheDocument();
  });

  it('shows the cancel confirmation in Spanish', () => {
    renderSection(baseSuscripcion);
    fireEvent.click(screen.getByRole('button', { name: /cancelar suscripción/i }));
    expect(screen.getByText(/mantendrás el acceso hasta el final del período actual/i)).toBeInTheDocument();
    expect(screen.queryByText(/your access will remain/i)).not.toBeInTheDocument();
  });

  it.each(['SUSPENDIDO', 'CANCELADO'] as const)('%s: disables the cobros list query', (estado) => {
    renderSection({ ...baseSuscripcion, estado });
    expect(useCobrosMock).toHaveBeenLastCalledWith(12, false);
  });

  it('ACTIVO: enables the cobros list query', () => {
    renderSection(baseSuscripcion);
    expect(useCobrosMock).toHaveBeenLastCalledWith(12, true);
  });

  it('SUSPENDIDO: shows the last charge status and message without the cobros list', () => {
    renderSection({
      ...baseSuscripcion,
      estado: 'SUSPENDIDO',
      ultimoCobro: {
        montoCop: 49900,
        plan: 'BASICO',
        status: 'DECLINED',
        statusMessage: 'Fondos insuficientes',
        createdAt: '2026-11-01T00:00:00',
      } as Suscripcion['ultimoCobro'],
    });
    expect(screen.getByText(/fondos insuficientes/i)).toBeInTheDocument();
  });

  it('shows the in-process message when polling cap is reached with cobroEnCurso', () => {
    vi.useFakeTimers();
    try {
      renderSection({ ...baseSuscripcion, cobroEnCurso: true });
      expect(screen.queryByText(/tu pago sigue en proceso/i)).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(121_000);
      });
      expect(screen.getByText(/tu pago sigue en proceso/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispatches fixtra:refresh-me when cobroEnCurso goes true -> false', () => {
    const spy = vi.fn();
    window.addEventListener('fixtra:refresh-me', spy);
    const { rerender } = renderSection({ ...baseSuscripcion, cobroEnCurso: true });
    expect(spy).not.toHaveBeenCalled();
    suscripcionQuery = { data: { ...baseSuscripcion, cobroEnCurso: false }, isLoading: false };
    rerender(<SuscripcionSection />);
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('fixtra:refresh-me', spy);
  });

  it('dispatches fixtra:refresh-me when estado changes', () => {
    const spy = vi.fn();
    window.addEventListener('fixtra:refresh-me', spy);
    const { rerender } = renderSection({ ...baseSuscripcion, estado: 'SUSPENDIDO' });
    expect(spy).not.toHaveBeenCalled();
    suscripcionQuery = { data: { ...baseSuscripcion, estado: 'ACTIVO' }, isLoading: false };
    rerender(<SuscripcionSection />);
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('fixtra:refresh-me', spy);
  });

  it('ACTIVO BASICO: marks the current plan and confirms before switching to PRO', () => {
    renderSection(baseSuscripcion);
    expect(screen.getByRole('button', { name: 'Plan actual' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a Pro' }));
    expect(screen.getByText(/se aplica desde tu próximo cobro/i)).toBeInTheDocument();
    expect(cambiarPlanMutation.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
    expect(cambiarPlanMutation.mutate).toHaveBeenCalledWith('PRO');
  });

  it('TRIAL without card: choosing a plan opens the payment flow', () => {
    renderSection({
      ...baseSuscripcion,
      plan: 'TRIAL',
      planDisplayName: 'Free trial',
      estado: 'TRIAL',
      metodoPago: null,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Elegir Pro' }));
    expect(screen.getByRole('dialog', { name: 'Método de pago' })).toBeInTheDocument();
    expect(cambiarPlanMutation.mutate).not.toHaveBeenCalled();
  });

  it('does not show plan cards when payments are disabled', () => {
    renderSection({ ...baseSuscripcion, pagosHabilitados: false });
    expect(screen.queryByRole('list', { name: /planes disponibles/i })).not.toBeInTheDocument();
  });
});
