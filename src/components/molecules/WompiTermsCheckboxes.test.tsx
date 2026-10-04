import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WompiTermsCheckboxes } from './WompiTermsCheckboxes';

const acceptance = {
  publicKey: 'pub_test_x',
  acceptanceToken: 'a',
  acceptancePermalink: 'https://wompi.co/terms',
  personalAuthToken: 'p',
  personalAuthPermalink: 'https://wompi.co/auth',
};

describe('WompiTermsCheckboxes', () => {
  it('renders two unchecked mandatory checkboxes with external permalinks', () => {
    render(<WompiTermsCheckboxes acceptance={acceptance} checked={false} onChange={vi.fn()} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', acceptance.acceptancePermalink);
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(links[1]).toHaveAttribute('href', acceptance.personalAuthPermalink);
    expect(links[1]).toHaveAttribute('target', '_blank');
    expect(links[1]).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('reports checked=true only when both checkboxes are checked', () => {
    const onChange = vi.fn();
    render(<WompiTermsCheckboxes acceptance={acceptance} checked={false} onChange={onChange} />);

    const [terms, auth] = screen.getAllByRole('checkbox');

    fireEvent.click(terms);
    expect(onChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(auth);
    expect(onChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(terms);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
