import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MetodoPagoFlow } from './MetodoPagoFlow';
import { ApiError } from '../../api/ApiClient';
import type { WompiAcceptance } from '../../types';

const acceptance: WompiAcceptance = {
  publicKey: 'pub_test_x',
  acceptanceToken: 'a',
  acceptancePermalink: 'https://wompi.co/terms',
  personalAuthToken: 'p',
  personalAuthPermalink: 'https://wompi.co/auth',
};

let acceptanceQuery: { data?: WompiAcceptance; isLoading: boolean; error: Error | null };
let registrarMutation: {
  mutate: ReturnType<typeof vi.fn>;
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null;
};
let tokenizeCardMock: ReturnType<typeof vi.fn>;

vi.mock('../../hooks/useBilling', () => ({
  useWompiAcceptance: () => acceptanceQuery,
  useRegistrarMetodoPago: () => registrarMutation,
}));

vi.mock('../../lib/wompiWidget', () => ({
  tokenizeCard: (...args: unknown[]) => tokenizeCardMock(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('MetodoPagoFlow', () => {
  beforeEach(() => {
    acceptanceQuery = { data: acceptance, isLoading: false, error: null };
    registrarMutation = {
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      error: null,
    };
    tokenizeCardMock = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const renderFlow = (props: { open: boolean; requiresPlan?: boolean; defaultEmail?: string } = { open: true }) =>
    render(<MetodoPagoFlow onClose={vi.fn()} {...props} />, { wrapper: createWrapper() });

  it('fetches acceptance only while open', () => {
    acceptanceQuery = { isLoading: true, error: null };
    const { rerender } = renderFlow({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<MetodoPagoFlow open onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error and keeps the widget closed when acceptance fails', () => {
    acceptanceQuery = { data: undefined, isLoading: false, error: new ApiError('Unavailable', 503) };
    renderFlow();
    expect(screen.getByText(/payment service unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add card/i })).not.toBeInTheDocument();
  });

  it('blocks "Add card" until both terms are checked and email is filled', () => {
    renderFlow({ open: true, defaultEmail: 'user@x.co' });
    const addButton = screen.getByRole('button', { name: /add card/i });
    expect(addButton).toBeDisabled();

    const [terms, auth] = screen.getAllByRole('checkbox');
    fireEvent.click(terms);
    expect(addButton).toBeDisabled();

    fireEvent.click(auth);
    expect(addButton).not.toBeDisabled();
  });

  it('shows a plan selector when requiresPlan is true and sends it to the API', async () => {
    tokenizeCardMock.mockResolvedValue('tok_test_123');
    renderFlow({ open: true, requiresPlan: true, defaultEmail: 'user@x.co' });

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);

    fireEvent.change(screen.getByLabelText(/plan/i), { target: { value: 'PRO' } });

    fireEvent.click(screen.getByRole('button', { name: /add card/i }));

    await waitFor(() => expect(tokenizeCardMock).toHaveBeenCalledWith({ publicKey: acceptance.publicKey }));
    await waitFor(() =>
      expect(registrarMutation.mutate).toHaveBeenCalledWith({
        cardToken: 'tok_test_123',
        acceptanceToken: acceptance.acceptanceToken,
        personalAuthToken: acceptance.personalAuthToken,
        email: 'user@x.co',
        plan: 'PRO',
      }),
    );
  });

  it('does not call the API when the widget is closed without a token', async () => {
    tokenizeCardMock.mockResolvedValue(null);
    renderFlow({ open: true, defaultEmail: 'user@x.co' });

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));

    await waitFor(() => expect(tokenizeCardMock).toHaveBeenCalled());
    expect(registrarMutation.mutate).not.toHaveBeenCalled();
  });

  it('renders a 503 error from the API as the user-safe message', async () => {
    registrarMutation = { ...registrarMutation, error: new ApiError('Bad gateway', 503) };
    renderFlow({ open: true, defaultEmail: 'user@x.co' });

    expect(screen.getByText(/payment service unavailable, please try again/i)).toBeInTheDocument();
  });

  it('renders a 400 error inline using the envelope message', async () => {
    registrarMutation = { ...registrarMutation, error: new ApiError('Invalid card token', 400) };
    renderFlow({ open: true, defaultEmail: 'user@x.co' });

    expect(screen.getByText(/invalid card token/i)).toBeInTheDocument();
  });
});
