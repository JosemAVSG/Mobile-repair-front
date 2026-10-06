import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import App from './App';

vi.mock('./hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('./components/templates/MainLayout', () => ({ MainLayout: () => <Outlet /> }));
vi.mock('./components/auth/RequireRole', () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./pages/InventarioPage', () => ({ InventarioPage: () => <p>INVENTARIO</p> }));
vi.mock('./pages/LoginPage', () => ({ LoginPage: () => null }));
vi.mock('./pages/RegistroPage', () => ({ RegistroPage: () => null }));
vi.mock('./pages/DashboardPage', () => ({ DashboardPage: () => null }));
vi.mock('./pages/MarcasPage', () => ({ MarcasPage: () => null }));
vi.mock('./pages/ModelosPage', () => ({ ModelosPage: () => null }));
vi.mock('./pages/ClientesPage', () => ({ ClientesPage: () => null }));
vi.mock('./pages/ClienteDetailPage', () => ({ ClienteDetailPage: () => null }));
vi.mock('./pages/OrdenesPage', () => ({ OrdenesPage: () => null }));
vi.mock('./pages/OrdenDetailPage', () => ({ OrdenDetailPage: () => null }));
vi.mock('./pages/PublicRepairStatusPage', () => ({ PublicRepairStatusPage: () => null }));
vi.mock('./pages/ConfiguracionPage', () => ({ ConfiguracionPage: () => null }));
vi.mock('./pages/TecnicosPage', () => ({ TecnicosPage: () => null }));

describe('App legacy routes', () => {
  it.each(['/repuestos', '/tarifas'])('%s redirects to /inventario', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText('INVENTARIO')).toBeInTheDocument();
  });
});
