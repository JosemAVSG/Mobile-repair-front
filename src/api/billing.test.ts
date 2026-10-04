import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ApiClient', () => ({
  ApiClient: { get: vi.fn(), post: vi.fn() },
}));

import { ApiClient } from './ApiClient';
import * as billing from './billing';

const get = vi.mocked(ApiClient.get);
const post = vi.mocked(ApiClient.post);

beforeEach(() => {
  get.mockReset().mockResolvedValue({});
  post.mockReset().mockResolvedValue({});
});

describe('api/billing (R-UI2)', () => {
  it('S-UI2.1: no exporta createCheckout ni getPortalLink', () => {
    expect(Object.keys(billing).sort()).toEqual(
      [
        'cambiarPlan',
        'cancelarSuscripcion',
        'getCobros',
        'getPlanes',
        'getSuscripcion',
        'getWompiAcceptance',
        'reactivarSuscripcion',
        'registrarMetodoPago',
      ].sort(),
    );
  });

  it('getSuscripcion / getWompiAcceptance / getCobros usan GET en sus rutas', async () => {
    await billing.getSuscripcion();
    await billing.getWompiAcceptance();
    await billing.getCobros();
    await billing.getCobros(5);
    expect(get).toHaveBeenNthCalledWith(1, '/api/billing/suscripcion');
    expect(get).toHaveBeenNthCalledWith(2, '/api/billing/wompi/acceptance');
    expect(get).toHaveBeenNthCalledWith(3, '/api/billing/cobros', { params: { limit: 12 } });
    expect(get).toHaveBeenNthCalledWith(4, '/api/billing/cobros', { params: { limit: 5 } });
  });

  it('registrarMetodoPago envía cardToken, acceptanceToken, personalAuthToken, email y plan opcional', async () => {
    const req = { cardToken: 'tok', acceptanceToken: 'a', personalAuthToken: 'p', email: 'x@y.co' };
    await billing.registrarMetodoPago(req);
    await billing.registrarMetodoPago({ ...req, plan: 'PRO' });
    expect(post).toHaveBeenNthCalledWith(1, '/api/billing/metodo-pago', req);
    expect(post).toHaveBeenNthCalledWith(2, '/api/billing/metodo-pago', { ...req, plan: 'PRO' });
  });

  it('cambiarPlan / cancelar / reactivar usan POST', async () => {
    await billing.cambiarPlan('BASICO');
    await billing.cancelarSuscripcion();
    await billing.reactivarSuscripcion();
    expect(post).toHaveBeenNthCalledWith(1, '/api/billing/plan', { plan: 'BASICO' });
    expect(post).toHaveBeenNthCalledWith(2, '/api/billing/cancelar');
    expect(post).toHaveBeenNthCalledWith(3, '/api/billing/reactivar');
  });
});
