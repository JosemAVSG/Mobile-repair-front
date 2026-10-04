import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  contactoEmpresarial: false,
};

let suscripcionQuery: { data?: Suscripcion; isLoading: boolean } = { isLoading: true };
let cambiarPlanMutation = { mutate: vi.fn(), isPending: false };
let cancelarMutation = { mutate: vi.fn(), isPending: false };
let reactivarMutation = { mutate: vi.fn(), isPending: false };

vi.mock('../../hooks/useBilling', () => ({
  useSuscripcion: () => suscripcionQuery,
  useCambiarPlan: () => cambiarPlanMutation,
  useCancelarSuscripcion: () => cancelarMutation,
  useReactivarSuscripcion: () => reactivarMutation,
  useCobros: () => ({ data: [] }),
}));

vi.mock('./MetodoPagoFlow', () => ({
  MetodoPagoFlow: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Payment method">
        <button onClick={onClose}>Close payment flow</button>
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
    expect(screen.getByText(/online payments coming soon/i)).toBeInTheDocument();
  });

  it('shows legacy plan badge only for LEGACY', () => {
    renderSection({ ...baseSuscripcion, plan: 'LEGACY', planDisplayName: 'Legacy' });
    expect(screen.getByText(/legacy plan/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows Contact sales for EMPRESARIAL', () => {
    renderSection({
      ...baseSuscripcion,
      plan: 'EMPRESARIAL',
      planDisplayName: 'Enterprise',
      contactoEmpresarial: true,
    });
    expect(screen.getByRole('link', { name: /contact sales/i })).toBeInTheDocument();
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

    expect(screen.getByText(/days left/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
    expect(screen.getByText(/you will be charged on/i)).toBeInTheDocument();
  });

  it('ACTIVO: shows card on file, next charge amount and date, and history', () => {
    renderSection(baseSuscripcion);

    expect(screen.getByText(/VISA •••• 4242/i)).toBeInTheDocument();
    const nextCharge = screen.getByText(/next charge/i);
    expect(nextCharge).toHaveTextContent(/01\/12\/2026/);
    expect(nextCharge).toHaveTextContent(/\$\s?49\.900/);
  });

  it('shows pending plan with applies-from date', () => {
    renderSection({
      ...baseSuscripcion,
      pendingPlan: 'PRO',
      pendingPlanDisplayName: 'Pro',
    });
    expect(screen.getByText(/pro applies from/i)).toBeInTheDocument();
  });

  it('shows cancel notice and calls reactivar when undo is clicked', () => {
    renderSection({ ...baseSuscripcion, cancelAtPeriodEnd: true });
    expect(screen.getByText(/it will cancel on/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /undo cancellation/i }));
    expect(reactivarMutation.mutate).toHaveBeenCalled();
  });

  it('opens a confirmation dialog before cancelling', () => {
    renderSection(baseSuscripcion);
    fireEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(cancelarMutation.mutate).toHaveBeenCalled();
  });

  it('SUSPENDIDO: offers update card and pay, hides plan/cancel actions', () => {
    renderSection({ ...baseSuscripcion, estado: 'SUSPENDIDO' });
    expect(screen.getByRole('button', { name: /update card and pay/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change plan/i })).not.toBeInTheDocument();
  });

  it('CANCELADO: offers reactivate with card', () => {
    renderSection({ ...baseSuscripcion, estado: 'CANCELADO' });
    expect(screen.getByRole('button', { name: /reactivate with card/i })).toBeInTheDocument();
  });

  it('PENDING: shows "payment in process"', () => {
    renderSection({ ...baseSuscripcion, cobroEnCurso: true });
    expect(screen.getByText(/payment in process/i)).toBeInTheDocument();
  });

  it('enMora: shows retry warning', () => {
    renderSection({ ...baseSuscripcion, enMora: true, nextChargeAt: '2026-12-02T00:00:00' });
    expect(screen.getByText(/we will retry on/i)).toBeInTheDocument();
  });
});
