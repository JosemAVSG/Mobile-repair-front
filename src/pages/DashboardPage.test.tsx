import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

const state = vi.hoisted(() => ({ isAdmin: true }));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isAdmin: state.isAdmin }) }));
vi.mock('../context/ConfigContext', () => ({
  useConfig: () => ({ config: { moneda: 'COP', tiposReparacion: [] } }),
}));
vi.mock('../hooks/useQueries', () => ({
  useOrdenes: () => ({
    data: [
      {
        id: 1,
        clienteId: 1,
        estado: 'REGISTRO',
        fechaEntrada: '2026-01-01T00:00:00',
        costoTotal: 0,
        costoFinal: 0,
        numeroOrden: 'A-1',
      },
    ],
    isPending: false, error: null, refetch: vi.fn() }),
  useClientes: () => ({ data: [], isPending: false, error: null, refetch: vi.fn() }),
}));

describe('DashboardPage shortcuts', () => {
  it('shows Ver Inventario only for ADMIN', () => {
    state.isAdmin = true;
    const { unmount } = render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Ver Inventario' })).toBeInTheDocument();
    unmount();

    state.isAdmin = false;
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Ver Inventario' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Nueva Reparación' })).toBeInTheDocument();
  });
});
