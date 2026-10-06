import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { ApiClient, ApiError } from './ApiClient';
import { uploadFotoOrden } from './ordenes';
import { updateConfig } from './configuracion';
import type { EtapaFoto, ShopConfigForm } from '../types';

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

describe('ApiClient: cuerpos FormData', () => {
  const original = ApiClient.defaults.adapter;
  type Sent = { data: unknown; contentType: unknown };
  let sent: Sent;

  const capture: Adapter = (config) => {
    sent = {
      data: config.data,
      contentType: (config.headers as unknown as { getContentType: () => unknown }).getContentType(),
    };
    return Promise.resolve({
      status: 200,
      statusText: 'OK',
      headers: {},
      config: config as InternalAxiosRequestConfig,
      data: { data: { ok: true }, meta: { success: true, message: '', timestamp: 'now' } },
    });
  };

  beforeEach(() => {
    ApiClient.defaults.adapter = capture;
  });
  afterEach(() => {
    ApiClient.defaults.adapter = original;
    vi.restoreAllMocks();
  });

  it('un FormData sale sin Content-Type JSON y el body sigue siendo el FormData', async () => {
    const fd = new FormData();
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }));

    await ApiClient.post('/api/ordenes/1/fotos', fd);

    expect(sent.data).toBeInstanceOf(FormData);
    expect(typeof sent.data).not.toBe('string');
    expect(String(sent.contentType ?? '')).not.toContain('application/json');
  });

  it('un objeto normal sigue enviándose como JSON', async () => {
    await ApiClient.post('/api/ordenes', { a: 1 });

    expect(sent.data).toBe('{"a":1}');
    expect(String(sent.contentType)).toContain('application/json');
  });

  it('uploadFotoOrden envía FormData con file y etapa', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });

    await uploadFotoOrden(7, file, 'INGRESO' as EtapaFoto);

    const fd = sent.data as FormData;
    expect(fd).toBeInstanceOf(FormData);
    expect((fd.get('file') as File).name).toBe('a.png');
    expect(fd.get('etapa')).toBe('INGRESO');
    expect(String(sent.contentType ?? '')).not.toContain('application/json');
  });

  it('updateConfig con logo File envía FormData', async () => {
    const logo = new File(['x'], 'logo.png', { type: 'image/png' });

    await updateConfig({ nombreTaller: 'Taller', logo } as ShopConfigForm);

    const fd = sent.data as FormData;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('nombreTaller')).toBe('Taller');
    expect((fd.get('logo') as File).name).toBe('logo.png');
    expect(String(sent.contentType ?? '')).not.toContain('application/json');
  });

  it('un 400 al subir la foto llega como ApiError con el mensaje del backend', async () => {
    ApiClient.defaults.adapter = failWith(400, envelope('Debe enviar un archivo de imagen'));

    const err = await rejected(
      uploadFotoOrden(7, new File(['x'], 'a.png'), 'INGRESO' as EtapaFoto),
    );

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Debe enviar un archivo de imagen');
  });
});
