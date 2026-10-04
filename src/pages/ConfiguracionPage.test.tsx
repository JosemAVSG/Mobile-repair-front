import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ConfiguracionPage } from './ConfiguracionPage';
import type { Suscripcion } from '../types';

vi.mock('../context/ConfigContext', () => ({
  useConfig: () => ({
    config: { nombreTaller: 'Taller', logo: null, colorPrimario: '#2563eb' },
    updateConfig: vi.fn(),
  }),
  DEFAULT_CONFIG: { colorPrimario: '#2563eb' },
}));

const BACKEND_CONFIG = { nombreTaller: 'Taller', logo: null };

vi.mock('../hooks/useShopConfig', () => ({
  useAdminShopConfig: () => ({ data: BACKEND_CONFIG, isPending: false }),
  useUpdateShopConfig: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, error: null }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { correo: 'admin@taller.co' } }),
}));

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
  features: [],
  contactoEmpresarial: false,
};

let flowProps: { open: boolean } = { open: false };

vi.mock('../hooks/useBilling', () => ({
  useSuscripcion: () => ({ data: baseSuscripcion, isLoading: false }),
  useCobros: () => ({ data: [] }),
  useCambiarPlan: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelarSuscripcion: () => ({ mutate: vi.fn(), isPending: false }),
  useReactivarSuscripcion: () => ({ mutate: vi.fn(), isPending: false }),
  useRegistrarMetodoPago: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, error: null }),
  useWompiAcceptance: () => ({ data: null, isLoading: false }),
}));

vi.mock('../components/organisms/MetodoPagoFlow', () => ({
  MetodoPagoFlow: (props: { open: boolean }) => {
    flowProps = props;
    return props.open ? <div role="dialog">Payment method flow</div> : null;
  },
}));

function renderPage(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <ConfiguracionPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ConfiguracionPage', () => {
  beforeEach(() => {
    flowProps = { open: false };
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the extracted SuscripcionSection', () => {
    renderPage(['/configuracion']);
    expect(screen.getByRole('region', { name: 'Suscripción' })).toBeInTheDocument();
  });

  it('auto-opens the payment method flow when ?pagar=1 is present', () => {
    renderPage(['/configuracion?pagar=1']);
    expect(flowProps.open).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not auto-open the payment flow without the query param', () => {
    renderPage(['/configuracion']);
    expect(flowProps.open).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
