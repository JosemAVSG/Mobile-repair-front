import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicBaseUrl, getSeguimientoUrl } from './publicUrl';

describe('publicUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('usa VITE_PUBLIC_URL sin barra final cuando está definida', () => {
    vi.stubEnv('VITE_PUBLIC_URL', 'https://fixtra.app/');
    expect(getPublicBaseUrl()).toBe('https://fixtra.app');
  });

  it('cae al origen actual cuando no hay variable', () => {
    vi.stubEnv('VITE_PUBLIC_URL', '');
    expect(getPublicBaseUrl()).toBe(window.location.origin);
  });

  it('arma el seguimiento con el código público, no con el id', () => {
    vi.stubEnv('VITE_PUBLIC_URL', 'https://repair.jglabs.tech');
    expect(getSeguimientoUrl({ id: 7, codigoPublico: 'K7M2QX9PRA' })).toBe(
      'https://repair.jglabs.tech/estado/K7M2QX9PRA',
    );
  });

  it('usa el id solo si la orden todavía no tiene código', () => {
    vi.stubEnv('VITE_PUBLIC_URL', 'https://repair.jglabs.tech');
    expect(getSeguimientoUrl({ id: 7, codigoPublico: null })).toBe('https://repair.jglabs.tech/estado/7');
  });
});
