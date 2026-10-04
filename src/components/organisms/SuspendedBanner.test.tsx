import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SuspendedBanner } from './SuspendedBanner';

type AuthMock = {
  isAuthenticated: boolean;
  billingBlocked: boolean;
  billingBlock: { codigo: 'SUSPENDIDO' | 'CANCELADO'; message?: string } | null;
  user: { estado?: string | null } | null;
};

let auth: AuthMock;
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));

const renderBanner = (a: Partial<AuthMock>) => {
  auth = {
    isAuthenticated: true,
    billingBlocked: false,
    billingBlock: null,
    user: { estado: 'ACTIVO' },
    ...a,
  };
  return render(
    <MemoryRouter>
      <SuspendedBanner />
    </MemoryRouter>,
  );
};

describe('SuspendedBanner', () => {
  it('S-UI5.1: SUSPENDIDO estado → suspension copy + "Update card" link to /configuracion?pagar=1', () => {
    renderBanner({ billingBlocked: true, user: { estado: 'SUSPENDIDO' } });

    expect(screen.getByRole('alert')).toHaveTextContent(/suspendida/i);
    const link = screen.getByRole('link', { name: 'Actualizar tarjeta' });
    expect(link).toHaveAttribute('href', '/configuracion?pagar=1');
  });

  it('S-UI5.2: CANCELADO estado → cancellation copy + "Update card" reactivation link', () => {
    renderBanner({ billingBlocked: true, user: { estado: 'CANCELADO' } });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/cancelada/i);
    expect(alert).not.toHaveTextContent(/suspendida/i);
    expect(screen.getByRole('link', { name: 'Actualizar tarjeta' })).toBeInTheDocument();
  });

  it('S-BU4.1b: 403 block (stale ACTIVO saved estado) uses the 403 codigo', () => {
    renderBanner({
      billingBlocked: true,
      billingBlock: { codigo: 'CANCELADO' },
      user: { estado: 'ACTIVO' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/cancelada/i);
  });

  it('A-SP2: prefers block.message', () => {
    renderBanner({
      billingBlocked: true,
      billingBlock: { codigo: 'SUSPENDIDO', message: 'Tu período de prueba terminó. Elige un plan.' },
      user: { estado: 'TRIAL' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Tu período de prueba terminó. Elige un plan.');
  });

  it('S-UI5.3: no banner for non-billing errors (billingBlocked false)', () => {
    renderBanner({ billingBlocked: false });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('is not shown when not authenticated', () => {
    renderBanner({ isAuthenticated: false, billingBlocked: true, user: null });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
