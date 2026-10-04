import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CobroStatusBadge } from './CobroStatusBadge';

describe('CobroStatusBadge', () => {
  it.each([
    ['APPROVED', 'Aprobado'],
    ['DECLINED', 'Rechazado'],
    ['ERROR', 'Error'],
    ['VOIDED', 'Anulado'],
    ['PENDING', 'Pago en proceso'],
    ['CLAIMED', 'Pago en proceso'],
  ] as const)('status %s renders "%s"', (status, label) => {
    render(<CobroStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
