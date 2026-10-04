import { describe, expect, it } from 'vitest';
import type {
  AuthUser,
  Cobro,
  MetodoPagoRequest,
  Suscripcion,
  WompiAcceptance,
} from '../types';

// Type tests run under `tsc -b` (this file is compiled): if the API contract changes,
// the build breaks even though vitest itself is type-agnostic.

const cobro: Cobro = {
  status: 'APPROVED',
  statusMessage: null,
  montoCop: 49900,
  plan: 'BASICO',
  createdAt: '2026-11-01T00:00:00',
  finalizedAt: '2026-11-01T00:01:00',
};

const sus: Suscripcion = {
  plan: 'BASICO',
  planDisplayName: 'Básico',
  estado: 'ACTIVO',
  trialEndsAt: null,
  currentPeriodEnd: '2026-12-01T00:00:00',
  nextChargeAt: '2026-12-01T00:00:00',
  cancelAtPeriodEnd: false,
  pendingPlan: 'PRO',
  pendingPlanDisplayName: 'Pro',
  precioCop: 49900,
  montoProximoCobroCop: 99900,
  metodoPago: { brand: 'VISA', last4: '4242' },
  ultimoCobro: { status: 'DECLINED', statusMessage: 'Fondos', montoCop: 49900, plan: 'BASICO', createdAt: 'x', finalizedAt: null },
  cobroEnCurso: false,
  enMora: false,
  pagosHabilitados: true,
  features: [],
  contactoEmpresarial: false,
};

const acceptance: WompiAcceptance = {
  publicKey: 'pub_test_x',
  acceptanceToken: 'a',
  acceptancePermalink: 'https://wompi.co/a',
  personalAuthToken: 'p',
  personalAuthPermalink: 'https://wompi.co/p',
};

const req: MetodoPagoRequest = {
  cardToken: 't',
  acceptanceToken: 'a',
  personalAuthToken: 'p',
  email: 'a@b.co',
};

describe('billing types (R-UI1)', () => {
  it('Suscripcion no tiene tienePortal ni tieneSuscripcion', () => {
    // @ts-expect-error Stripe-era field removed
    void sus.tienePortal;
    // @ts-expect-error Stripe-era field removed
    void sus.tieneSuscripcion;
    expect(sus.metodoPago?.last4).toBe('4242');
  });

  it('metodoPago y ultimoCobro son nullables; MetodoPagoRequest.plan es opcional', () => {
    const s: Suscripcion = { ...sus, metodoPago: null, ultimoCobro: null };
    expect(s.metodoPago).toBeNull();
    expect({ ...req, plan: 'PRO' as const }.plan).toBe('PRO');
    expect(cobro.status).toBe('APPROVED');
    expect(acceptance.publicKey).toMatch(/^pub_/);
  });

  it('AuthUser conserva los campos de billing', () => {
    const u: Partial<AuthUser> = { estado: 'SUSPENDIDO', plan: 'PRO' };
    expect(u.estado).toBe('SUSPENDIDO');
  });
});
