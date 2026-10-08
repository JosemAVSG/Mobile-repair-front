import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ApiClient', () => ({ ApiClient: { get: vi.fn() } }));

import { ApiClient } from './ApiClient';
import { getDashboardResumen } from './dashboard';
import { getMovimientosInventario } from './inventario';

const get = vi.mocked(ApiClient.get);

beforeEach(() => get.mockReset().mockResolvedValue({}));

describe('dashboard api', () => {
  it('sin fechas no manda parámetros', async () => {
    await getDashboardResumen();
    expect(get).toHaveBeenCalledWith('/api/dashboard/resumen');
  });

  it('manda desde y hasta', async () => {
    await getDashboardResumen('2026-10-01', '2026-10-15');
    expect(get).toHaveBeenCalledWith('/api/dashboard/resumen?desde=2026-10-01&hasta=2026-10-15');
  });

  it('movimientos acepta limit', async () => {
    await getMovimientosInventario({ limit: 10 });
    expect(get).toHaveBeenCalledWith('/api/inventario/movimientos?limit=10');
  });
});
