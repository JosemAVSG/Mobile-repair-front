import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistorialCobros } from './HistorialCobros';
import type { Cobro } from '../../types';

const cobros: Cobro[] = [
  {
    status: 'APPROVED',
    statusMessage: null,
    montoCop: 99900,
    plan: 'PRO',
    createdAt: '2026-11-01T00:00:00',
    finalizedAt: '2026-11-01T00:01:00',
  },
  {
    status: 'DECLINED',
    statusMessage: 'Insufficient funds',
    montoCop: 49900,
    plan: 'BASICO',
    createdAt: '2026-10-01T00:00:00',
    finalizedAt: '2026-10-01T00:01:00',
  },
];

describe('HistorialCobros', () => {
  it('renders charges newest first with formatted amounts, badges and plans', () => {
    render(<HistorialCobros cobros={cobros} ultimoCobro={cobros[1]} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    // Newest first
    expect(rows[0]).toHaveTextContent(/\$\s?99\.900/);
    expect(rows[0]).toHaveTextContent(/PRO/);
    expect(rows[0]).toHaveTextContent(/Approved/);

    expect(rows[1]).toHaveTextContent(/\$\s?49\.900/);
    expect(rows[1]).toHaveTextContent(/BASICO/);
    expect(rows[1]).toHaveTextContent(/Declined/);
  });

  it('shows an empty state when there are no charges', () => {
    render(<HistorialCobros cobros={[]} />);
    expect(screen.getByText(/no payment history/i)).toBeInTheDocument();
  });

  it('shows the last declined charge status message', () => {
    render(<HistorialCobros cobros={cobros} ultimoCobro={cobros[1]} />);
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
  });
});
