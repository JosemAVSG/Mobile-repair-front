import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { useAuth } from '../hooks/useAuth';
import type { AuthUser } from '../types';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  registerTaller: vi.fn(),
  getMe: vi.fn(),
}));

import { getMe, login, registerTaller } from '../api/auth';

const response = (tallerId: number) => ({
  token: `jwt-${tallerId}`,
  rol: 'ADMIN' as const,
  tallerId,
  nombreTaller: `Taller ${tallerId}`,
  user: {
    id: 1,
    nombre: 'Admin',
    username: 'admin',
    rol: 'ADMIN' as const,
    activo: true,
  },
});

function setup() {
  const queryClient = new QueryClient();
  const clear = vi.spyOn(queryClient, 'clear');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(() => useAuth(), { wrapper });
  return { ...hook, queryClient, clear };
}

function storedAuth(tallerId: number, token = `jwt-${tallerId}`) {
  return JSON.stringify({
    token,
    user: { ...response(tallerId).user, tallerId },
  });
}

function dispatchStorage(newValue: string | null) {
  const oldValue = localStorage.getItem('auth');
  act(() => {
    if (newValue === null) {
      localStorage.removeItem('auth');
    } else {
      localStorage.setItem('auth', newValue);
    }
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'auth', oldValue, newValue }),
    );
  });
}

describe('AuthContext: aislamiento de caché entre talleres', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getMe).mockReset();
    vi.mocked(login).mockReset();
    vi.mocked(registerTaller).mockReset();
  });
  afterEach(() => localStorage.clear());

  it('login limpia la caché y guarda el tallerId', async () => {
    vi.mocked(login).mockResolvedValue(response(7));
    const { result, queryClient, clear } = setup();
    queryClient.setQueryData(['clientes'], [{ id: 1 }]);

    await act(async () => {
      await result.current.login('admin', 'secret');
    });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['clientes'])).toBeUndefined();
    expect(result.current.user?.tallerId).toBe(7);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('register limpia la caché e inicia sesión', async () => {
    vi.mocked(registerTaller).mockResolvedValue(response(9));
    const { result, queryClient, clear } = setup();
    queryClient.setQueryData(['ordenes'], [{ id: 5 }]);

    await act(async () => {
      await result.current.register({
        nombreTaller: 'Nuevo',
        adminNombre: 'Ana',
        username: 'ana',
        password: 'password1',
        correo: 'ana@x.com',
        website: '',
      });
    });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['ordenes'])).toBeUndefined();
    expect(result.current.user?.tallerId).toBe(9);
    expect(JSON.parse(localStorage.getItem('auth')!).token).toBe('jwt-9');
  });

  it('logout limpia la caché y la sesión', async () => {
    vi.mocked(login).mockResolvedValue(response(7));
    const { result, queryClient, clear } = setup();

    await act(async () => {
      await result.current.login('admin', 'secret');
    });
    queryClient.setQueryData(['marcas'], [{ id: 3 }]);
    clear.mockClear();

    act(() => result.current.logout());

    expect(clear).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['marcas'])).toBeUndefined();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('auth')).toBeNull();
  });

  it('un login fallido NO limpia la caché', async () => {
    vi.mocked(login).mockRejectedValue(new Error('Credenciales inválidas'));
    const { result, clear } = setup();

    await act(async () => {
      await expect(result.current.login('x', 'y')).rejects.toThrow();
    });

    expect(clear).not.toHaveBeenCalled();
  });

  it('sincroniza cambios de sesión de otra pestaña e ignora valores malformados', async () => {
    vi.mocked(login).mockResolvedValue(response(7));
    const { result, queryClient, clear } = setup();

    await act(async () => {
      await result.current.login('admin', 'secret');
    });
    clear.mockClear();

    dispatchStorage(storedAuth(9));
    expect(clear).toHaveBeenCalledTimes(1);
    expect(result.current.token).toBe('jwt-9');
    expect(result.current.user?.tallerId).toBe(9);

    queryClient.setQueryData(['clientes'], [{ id: 1 }]);
    clear.mockClear();
    dispatchStorage('{malformed');
    expect(clear).not.toHaveBeenCalled();
    expect(result.current.user?.tallerId).toBe(9);
    expect(queryClient.getQueryData(['clientes'])).toEqual([{ id: 1 }]);

    dispatchStorage(null);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('no restaura la sesión inicial después de un logout en otra pestaña', async () => {
    localStorage.setItem('auth', storedAuth(7));
    let resolveMe: (user: AuthUser) => void = () => undefined;
    vi.mocked(getMe).mockReturnValue(
      new Promise<AuthUser>((resolve) => {
        resolveMe = resolve;
      }),
    );
    const { result } = setup();

    dispatchStorage(null);
    await act(async () => {
      resolveMe({ ...response(7).user, tallerId: 7 });
      await Promise.resolve();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('no invalida la nueva sesión si la validación inicial falla tarde', async () => {
    localStorage.setItem('auth', storedAuth(7));
    let rejectMe: (reason?: unknown) => void = () => undefined;
    vi.mocked(getMe).mockReturnValue(
      new Promise<AuthUser>((_, reject) => {
        rejectMe = reject;
      }),
    );
    const { result } = setup();

    dispatchStorage(storedAuth(9));
    await act(async () => {
      rejectMe(new Error('stale validation'));
      await Promise.resolve();
    });

    expect(result.current.user?.tallerId).toBe(9);
    expect(result.current.token).toBe('jwt-9');
  });

  it('conserva el taller guardado cuando /me omite tallerId', async () => {
    localStorage.setItem('auth', storedAuth(7));
    vi.mocked(getMe).mockResolvedValue({ ...response(7).user, tallerId: undefined });
    const { result } = setup();

    await waitFor(() => expect(result.current.validating).toBe(false));

    expect(result.current.user?.tallerId).toBe(7);
    expect(JSON.parse(localStorage.getItem('auth')!).user.tallerId).toBe(7);
  });
});
