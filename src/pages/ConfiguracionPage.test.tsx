import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../api/ApiClient';
import { ConfiguracionPage } from './ConfiguracionPage';
import type { Suscripcion } from '../types';

vi.mock('../context/ConfigContext', () => ({
  useConfig: () => ({
    config: { nombreTaller: 'Taller', logo: null, colorPrimario: '#2563eb' },
    updateConfig: vi.fn(),
  }),
  DEFAULT_CONFIG: { colorPrimario: '#2563eb' },
}));
const BACKEND_CONFIG = { nombreTaller: 'Taller', logo: null }; // referencia estable (evita bucle del useEffect)
vi.mock('../hooks/useShopConfig', () => ({
  useAdminShopConfig: () => ({ data: BACKEND_CONFIG, isPending: false }),
  useUpdateShopConfig: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, error: null }),
}));
vi.mock('../api/billing', () => ({
  getSuscripcion: vi.fn(),
  createCheckout: vi.fn(),
  getPortalLink: vi.fn(),
}));

import { createCheckout, getPortalLink, getSuscripcion } from '../api/billing';

const FEATURES = ['Técnicos ilimitados', 'Inventario y alertas de stock', 'Métricas avanzadas'];

const sus = (over: Partial<Suscripcion>): Suscripcion => ({
  plan: 'PRO',
  planDisplayName: 'Pro',
  estado: 'ACTIVO',
  trialEndsAt: null,
  currentPeriodEnd: null,
  precioCop: 99900,
  features: FEATURES,
  contactoEmpresarial: false,
  tieneSuscripcion: true,
  tienePortal: true,
  ...over,
});

async function renderWith(s: Suscripcion) {
  vi.mocked(getSuscripcion).mockResolvedValue(s);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ConfiguracionPage />
    </QueryClientProvider>,
  );
  await screen.findByText(s.planDisplayName);
  return screen.getByRole('region', { name: 'Suscripción' });
}

describe('ConfiguracionPage: sección Suscripción', () => {
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    vi.mocked(createCheckout).mockReset();
    vi.mocked(getPortalLink).mockReset();
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('S-BU3.1: TRIAL → cuenta regresiva y elección de plan; el click redirige a Stripe', async () => {
    vi.mocked(createCheckout).mockResolvedValue('https://stripe.test/pro');
    const trialEndsAt = new Date(Date.now() + 4.5 * 86_400_000).toISOString();
    const section = await renderWith(
      sus({
        plan: 'TRIAL',
        planDisplayName: 'Prueba',
        estado: 'TRIAL',
        trialEndsAt,
        precioCop: null,
        tieneSuscripcion: false,
        tienePortal: false,
      }),
    );

    expect(section).toHaveTextContent(/5 días/);
    expect(within(section).getByRole('button', { name: /Elegir plan Básico/ })).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: /Elegir plan Pro/ }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://stripe.test/pro'));
    expect(createCheckout).toHaveBeenCalledWith('PRO');
  });

  it('S-BU3.2: BASICO → $49.900 COP, features; Mejorar plan va al PORTAL (no a un 2do checkout)', async () => {
    vi.mocked(getPortalLink).mockResolvedValue('https://stripe.test/portal-up');
    const section = await renderWith(
      sus({
        plan: 'BASICO',
        planDisplayName: 'Básico',
        precioCop: 49900,
        features: ['Técnicos hasta 2'],
        currentPeriodEnd: '2026-11-05T12:00:00',
      }),
    );

    expect(section).toHaveTextContent(/\$\s?49\.900/);
    expect(section).toHaveTextContent('Técnicos hasta 2');
    expect(section).toHaveTextContent('05/11/2026'); // currentPeriodEnd visible
    expect(within(section).getByRole('button', { name: 'Gestionar suscripción' })).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: /Mejorar plan/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://stripe.test/portal-up'));
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('PRO → solo Gestionar suscripción (portal)', async () => {
    vi.mocked(getPortalLink).mockResolvedValue('https://stripe.test/portal');
    const section = await renderWith(sus({}));

    expect(within(section).queryByRole('button', { name: /Elegir plan|Mejorar/ })).toBeNull();
    fireEvent.click(within(section).getByRole('button', { name: 'Gestionar suscripción' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://stripe.test/portal'));
  });

  it('S-BU3.3: EMPRESARIAL → Contactar (mailto), sin checkout', async () => {
    vi.stubEnv('VITE_BILLING_CONTACT_EMAIL', 'ventas@fixtra.app');
    const section = await renderWith(
      sus({ plan: 'EMPRESARIAL', planDisplayName: 'Empresarial', precioCop: null, contactoEmpresarial: true }),
    );

    expect(within(section).getByRole('link', { name: 'Contactar' })).toHaveAttribute(
      'href',
      'mailto:ventas@fixtra.app',
    );
    expect(within(section).queryByRole('button')).toBeNull();
  });

  it('S-BU3.4: LEGACY → badge "Plan heredado" y ninguna acción de Stripe', async () => {
    const section = await renderWith(
      sus({ plan: 'LEGACY', planDisplayName: 'Heredado', precioCop: null }),
    );

    expect(section).toHaveTextContent('Plan heredado');
    expect(within(section).queryByRole('button')).toBeNull();
    expect(within(section).queryByRole('link')).toBeNull();
  });

  it('S-BU3.5: SUSPENDIDO con suscripción → "Actualizar pago" al portal, sin elegir plan', async () => {
    vi.mocked(getPortalLink).mockResolvedValue('https://stripe.test/pay');
    const section = await renderWith(
      sus({ plan: 'BASICO', planDisplayName: 'Básico', estado: 'SUSPENDIDO', precioCop: 49900 }),
    );

    expect(section).toHaveTextContent(/suspendida/i);
    expect(within(section).queryByRole('button', { name: /Elegir plan/ })).toBeNull();
    fireEvent.click(within(section).getByRole('button', { name: 'Actualizar pago' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://stripe.test/pay'));
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('SUSPENDIDO sin suscripción (trial vencido) → elegir plan por checkout, sin portal', async () => {
    vi.mocked(createCheckout).mockResolvedValue('https://stripe.test/renew');
    const section = await renderWith(
      sus({
        plan: 'TRIAL',
        planDisplayName: 'Prueba',
        estado: 'SUSPENDIDO',
        precioCop: null,
        tieneSuscripcion: false,
        tienePortal: false,
      }),
    );

    expect(within(section).queryByRole('button', { name: /Gestionar suscripción|Actualizar pago/ })).toBeNull();
    fireEvent.click(within(section).getByRole('button', { name: /Elegir plan Pro/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://stripe.test/renew'));
  });

  it('el portal solo se ofrece con tienePortal', async () => {
    const section = await renderWith(sus({ plan: 'TRIAL', planDisplayName: 'Prueba', estado: 'TRIAL',
      tieneSuscripcion: false, tienePortal: false, precioCop: null }));

    expect(within(section).queryByRole('button', { name: 'Gestionar suscripción' })).toBeNull();
    expect(within(section).getByRole('button', { name: /Elegir plan Básico/ })).toBeInTheDocument();
  });

  it('S-BU3.6: CANCELADO → copy de reactivación + checkout (y portal si hay customer)', async () => {
    vi.mocked(createCheckout).mockResolvedValue('https://stripe.test/react');
    const section = await renderWith(
      sus({ plan: 'PRO', planDisplayName: 'Pro', estado: 'CANCELADO' }),
    );

    expect(section).toHaveTextContent(/cancelada/i);
    expect(within(section).getByRole('button', { name: 'Gestionar suscripción' })).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: /Elegir plan Básico/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://stripe.test/react'));
    expect(createCheckout).toHaveBeenCalledWith('BASICO');
  });

  it('error del portal se muestra en la UI', async () => {
    vi.mocked(getPortalLink).mockRejectedValue(new ApiError('Aún no tienes una suscripción activa', 400, {}));
    const section = await renderWith(sus({}));

    fireEvent.click(within(section).getByRole('button', { name: 'Gestionar suscripción' }));
    expect(await within(section).findByRole('alert')).toHaveTextContent('Aún no tienes una suscripción activa');
  });

  it('error de checkout se muestra en la UI', async () => {
    vi.mocked(createCheckout).mockRejectedValue(new ApiError('Plan sin precio configurado', 400, {}));
    const section = await renderWith(
      sus({ plan: 'TRIAL', planDisplayName: 'Prueba', estado: 'TRIAL', tieneSuscripcion: false,
        tienePortal: false, precioCop: null }),
    );

    fireEvent.click(within(section).getByRole('button', { name: /Elegir plan Pro/ }));
    expect(await within(section).findByRole('alert')).toHaveTextContent('Plan sin precio configurado');
  });
});
