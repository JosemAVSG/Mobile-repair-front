import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainLayout } from './MainLayout';
import { SIDEBAR_COLLAPSED_KEY } from '../../hooks/useSidebarCollapsed';

const auth = { rol: 'ADMIN' as 'ADMIN' | 'TECNICO', logout: vi.fn() };

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { rol: auth.rol, nombre: 'Ana Pérez', username: 'ana' },
    logout: auth.logout,
  }),
}));
vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({ config: { nombreTaller: 'Taller Norte', logo: null } }),
}));
vi.mock('../organisms/SuspendedBanner', () => ({ SuspendedBanner: () => null }));
vi.mock('../organisms/TrialBanner', () => ({ TrialBanner: () => null }));
vi.mock('../molecules/Breadcrumbs', () => ({ Breadcrumbs: () => null }));

function setup(rol: 'ADMIN' | 'TECNICO') {
  auth.rol = rol;
  return render(
    <MemoryRouter>
      <MainLayout>
        <p>contenido</p>
      </MainLayout>
    </MemoryRouter>,
  );
}

const sidebarEl = () => document.getElementById('app-sidebar');

describe('MainLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    auth.logout.mockClear();
  });

  it('technician: no sidebar, no menu buttons, shows taller name and logout', () => {
    setup('TECNICO');
    expect(sidebarEl()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abrir menú' })).toBeNull();
    expect(screen.queryByRole('button', { name: /menú/i })).toBeNull();
    expect(screen.getByRole('heading', { name: /Taller Norte/ })).toBeInTheDocument();
    expect(screen.getByText('Fixtra')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Sesión' }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it('admin: sidebar visible by default, toggle hides and shows it', () => {
    setup('ADMIN');
    expect(sidebarEl()).toHaveAttribute('data-collapsed', 'false');
    const toggle = screen.getByRole('button', { name: 'Ocultar menú' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'app-sidebar');

    fireEvent.click(toggle);
    expect(sidebarEl()).toHaveAttribute('data-collapsed', 'true');
    const reopen = screen.getByRole('button', { name: 'Mostrar menú' });
    expect(reopen).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('true');

    fireEvent.click(reopen);
    expect(sidebarEl()).toHaveAttribute('data-collapsed', 'false');
  });

  it('admin: restores persisted collapsed state', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
    setup('ADMIN');
    expect(sidebarEl()).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('button', { name: 'Mostrar menú' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Taller Norte/ })).toBeInTheDocument();
  });

  it('admin: falls back to visible when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setup('ADMIN');
    expect(sidebarEl()).toHaveAttribute('data-collapsed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú' }));
    expect(sidebarEl()).toHaveAttribute('data-collapsed', 'true');
  });

  it('mobile drawer: hamburger opens it independently of collapse state', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
    setup('ADMIN');
    expect(sidebarEl()?.className).toContain('-translate-x-full');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(sidebarEl()?.className).not.toContain('-translate-x-full');
    expect(sidebarEl()?.className).toContain('translate-x-0');
  });
});
