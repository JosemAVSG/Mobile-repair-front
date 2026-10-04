import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { ConfigProvider, useConfig } from './ConfigContext';
import { useAuth } from '../hooks/useAuth';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  registerTaller: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock('../api/configuracion', () => ({
  getPublicConfig: vi.fn(),
}));

import { login } from '../api/auth';
import { getPublicConfig } from '../api/configuracion';

const registeredSession = {
  token: 'jwt-7',
  rol: 'ADMIN' as const,
  tallerId: 7,
  user: {
    id: 1,
    nombre: 'Admin',
    username: 'admin',
    rol: 'ADMIN' as const,
    activo: true,
  },
};

function setup() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfigProvider>{children}</ConfigProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
  return renderHook(
    () => ({ config: useConfig().config, auth: useAuth() }),
    { wrapper },
  );
}

describe('ConfigContext anonymous branding', () => {
  beforeEach(() => {
    localStorage.clear();
    document
      .querySelectorAll('link[rel~="icon"]')
      .forEach((link) => link.remove());
    vi.mocked(login).mockReset();
    vi.mocked(getPublicConfig).mockReset();
  });

  afterEach(() => localStorage.clear());

  it('keeps Fixtra branding and does not query public config without a session', () => {
    vi.mocked(getPublicConfig).mockResolvedValue({
      nombreTaller: 'Shop from another tenant',
      logo: 'https://example.com/shop.png',
    });

    const { result } = setup();

    expect(result.current.config.nombreTaller).toBe('Fixtra');
    expect(result.current.config.logo).toBeNull();
    expect(getPublicConfig).not.toHaveBeenCalled();
  });

  it('keeps the product favicon when no tenant logo is configured', async () => {
    setup();

    await waitFor(() =>
      expect(
        document.querySelector<HTMLLinkElement>('link[rel~="icon"]'),
      ).toHaveAttribute('href', '/favicon.svg'),
    );
  });

  it('fetches tenant branding after a session is established', async () => {
    vi.mocked(login).mockResolvedValue(registeredSession);
    vi.mocked(getPublicConfig).mockResolvedValue({
      nombreTaller: 'Taller 7',
      logo: 'https://example.com/taller-7.png',
    });
    const { result } = setup();

    await act(async () => {
      await result.current.auth.login('admin', 'secret');
    });
    await waitFor(() => expect(getPublicConfig).toHaveBeenCalledTimes(1));

    expect(result.current.config.nombreTaller).toBe('Taller 7');
    expect(result.current.config.logo).toBe('https://example.com/taller-7.png');
    expect(
      document.querySelector<HTMLLinkElement>('link[rel~="icon"]'),
    ).toHaveAttribute('href', 'https://example.com/taller-7.png');
  });
});
