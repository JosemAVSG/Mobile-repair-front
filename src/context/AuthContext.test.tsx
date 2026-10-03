import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { useAuth } from '../hooks/useAuth';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  registerTaller: vi.fn(),
  getMe: vi.fn(),
}));

import { login, registerTaller } from '../api/auth';

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

describe('AuthContext: aislamiento de caché entre talleres', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
