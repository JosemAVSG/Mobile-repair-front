import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { rol: 'ADMIN' } }) }));
vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({ config: { nombreTaller: 'Fixtra' } }),
}));

describe('Sidebar', () => {
  it('has Inventario but no Precios group, Repuestos or Tarifas', () => {
    render(
      <MemoryRouter>
        <Sidebar isOpen onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Inventario' })).toBeInTheDocument();
    expect(screen.queryByText('Precios')).toBeNull();
    expect(screen.queryByText('Repuestos')).toBeNull();
    expect(screen.queryByText('Tarifas')).toBeNull();
  });
});
