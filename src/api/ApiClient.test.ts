import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { ApiClient, ApiError } from './ApiClient';

type Adapter = NonNullable<typeof ApiClient.defaults.adapter>;

function failWith(status: number, body: unknown): Adapter {
  return (config) =>
    Promise.reject(
      new AxiosError('fail', 'ERR_BAD_REQUEST', config as InternalAxiosRequestConfig, null, {
        status,
        statusText: '',
        data: body,
        headers: {},
        config: config as InternalAxiosRequestConfig,
      }),
    );
}

const rejected = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error('se esperaba un rechazo');
    },
    (e: ApiError) => e,
  );

const envelope = (message: string, codigo?: string) => ({
  data: null,
  meta: { success: false, message, timestamp: 'now', ...(codigo ? { codigo } : {}) },
});

describe('ApiClient: 403 con codigo de billing', () => {
  const original = ApiClient.defaults.adapter;
  let events: CustomEvent[];
  const listener = (e: Event) => events.push(e as CustomEvent);

  beforeEach(() => {
    events = [];
    localStorage.setItem('auth', JSON.stringify({ token: 'jwt', user: { username: 'a' } }));
    window.addEventListener('fixtra:billing-block', listener);
  });
  afterEach(() => {
    ApiClient.defaults.adapter = original;
    window.removeEventListener('fixtra:billing-block', listener);
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each(['SUSPENDIDO', 'CANCELADO'])(
    'S-BU5.3: 403 %s mantiene la sesión, emite el evento y rechaza con codigo',
    async (codigo) => {
      ApiClient.defaults.adapter = failWith(403, envelope('Bloqueado', codigo));

      const err = await rejected(ApiClient.get('/api/clientes'));

      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(403);
      expect(err.codigo).toBe(codigo);
      expect(err.message).toBe('Bloqueado');
      expect(localStorage.getItem('auth')).not.toBeNull();
      expect(events).toHaveLength(1);
      expect(events[0].detail).toEqual({ codigo, message: 'Bloqueado' });
    },
  );

  it('401 con sesión guardada sigue haciendo logout (sin evento)', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, pathname: '/clientes', assign });
    ApiClient.defaults.adapter = failWith(401, envelope('Token inválido'));

    const err = await rejected(ApiClient.get('/api/clientes'));

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(localStorage.getItem('auth')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
    expect(events).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it.each([
    ['sin codigo', envelope('Acceso denegado')],
    ['con codigo de plan (LIMITE_PLAN)', envelope('Tu plan permite hasta 2', 'LIMITE_PLAN')],
  ])('otro 403 %s: ApiError simple, sin evento y sin logout', async (_n, body) => {
    ApiClient.defaults.adapter = failWith(403, body);

    const err = await rejected(ApiClient.get('/api/tecnicos'));

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(events).toHaveLength(0);
    expect(localStorage.getItem('auth')).not.toBeNull();
  });
});
