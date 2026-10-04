import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

vi.mock('../api/billing', () => ({
  getSuscripcion: vi.fn(),
}));

import { getSuscripcion } from '../api/billing';

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
  features: ['Up to 2 technicians'],
  contactoEmpresarial: false,
};

function renderPage(s: Suscripcion = baseSuscripcion) {
  vi.mocked(getSuscripcion).mockResolvedValue(s);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfiguracionPage />
    </QueryClientProvider>,
  );
}

describe('ConfiguracionPage', () => {
  beforeEach(() => {
    vi.mocked(getSuscripcion).mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the subscription section using the Wompi contract', async () => {
    renderPage();
    expect(await screen.findByText('Basic')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Suscripción' })).toBeInTheDocument();
  });
});
