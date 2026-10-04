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
  it('S-BU4.1: estado SUSPENDIDO (200 login//me) → copy de suspensión + link a /configuracion', () => {
    renderBanner({ billingBlocked: true, user: { estado: 'SUSPENDIDO' } });

    expect(screen.getByRole('alert')).toHaveTextContent(/suspendida/i);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/configuracion');
  });

  it('S-BU4.2: estado CANCELADO sin evento → copy de cancelación (no cae a SUSPENDIDO)', () => {
    renderBanner({ billingBlocked: true, user: { estado: 'CANCELADO' } });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/cancelada/i);
    expect(alert).not.toHaveTextContent(/suspendida/i);
  });

  it('S-BU4.1b: bloqueo por 403 (estado guardado stale ACTIVO) usa el codigo del 403', () => {
    renderBanner({
      billingBlocked: true,
      billingBlock: { codigo: 'CANCELADO' },
      user: { estado: 'ACTIVO' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/cancelada/i);
  });

  it('A-SP2: prefiere block.message (trial vencido colapsa a SUSPENDIDO, el copy viene del mensaje)', () => {
    renderBanner({
      billingBlocked: true,
      billingBlock: { codigo: 'SUSPENDIDO', message: 'Tu período de prueba terminó. Elige un plan.' },
      user: { estado: 'TRIAL' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Tu período de prueba terminó. Elige un plan.');
  });

  it('S-BU4.3: sin bloqueo (p.ej. un 400 de validación) no hay banner', () => {
    renderBanner({ billingBlocked: false });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('no se muestra sin sesión', () => {
    renderBanner({ isAuthenticated: false, billingBlocked: true, user: null });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
