import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TrialBanner } from './TrialBanner';

type AuthMock = {
  isAuthenticated: boolean;
  billingBlocked: boolean;
  user: { rol: string; estado?: string | null; trialEndsAt?: string | null } | null;
};

let auth: AuthMock;
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const renderBanner = (user: AuthMock['user'], extra: Partial<AuthMock> = {}) => {
  auth = { isAuthenticated: true, billingBlocked: false, user, ...extra };
  return render(
    <MemoryRouter>
      <TrialBanner />
    </MemoryRouter>,
  );
};

describe('TrialBanner', () => {
  it('shows days left and a link to choose a plan when the trial is ending', () => {
    renderBanner({ rol: 'ADMIN', estado: 'TRIAL', trialEndsAt: inDays(3) });
    expect(screen.getByRole('status')).toHaveTextContent(/quedan 3 días/i);
    expect(screen.getByRole('link', { name: 'Elegir plan' })).toHaveAttribute('href', '/configuracion');
  });

  it('is hidden when the trial has plenty of time left', () => {
    renderBanner({ rol: 'ADMIN', estado: 'TRIAL', trialEndsAt: inDays(20) });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('is hidden for technicians and for non-trial tenants', () => {
    renderBanner({ rol: 'TECNICO', estado: 'TRIAL', trialEndsAt: inDays(2) });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('is hidden when the tenant is already active', () => {
    renderBanner({ rol: 'ADMIN', estado: 'ACTIVO', trialEndsAt: inDays(2) });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
