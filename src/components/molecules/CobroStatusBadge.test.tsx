import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CobroStatusBadge } from './CobroStatusBadge';

describe('CobroStatusBadge', () => {
  it.each([
    ['APPROVED', 'Approved'],
    ['DECLINED', 'Declined'],
    ['ERROR', 'Error'],
    ['VOIDED', 'Voided'],
    ['PENDING', 'Payment in process'],
    ['CLAIMED', 'Payment in process'],
  ] as const)('status %s renders "%s"', (status, label) => {
    render(<CobroStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
