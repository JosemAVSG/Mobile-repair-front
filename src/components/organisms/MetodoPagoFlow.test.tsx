import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PLANES_FALLBACK as PLANES } from '../../lib/planesFallback';
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
  usePlanes: () => ({ data: PLANES, isLoading: false }),
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
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('shows an error and keeps the widget closed when acceptance fails', () => {
    acceptanceQuery = { data: undefined, isLoading: false, error: new ApiError('Unavailable', 503) };
    renderFlow();
    expect(screen.getByText(/servicio de pagos no disponible/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar tarjeta/i })).not.toBeInTheDocument();
  });

  it('blocks "Add card" until both terms are checked and email is filled', () => {
    renderFlow({ open: true, defaultEmail: 'user@x.co' });
    const addButton = screen.getByRole('button', { name: /agregar tarjeta/i });
    expect(addButton).toBeDisabled();
    expect(screen.getByText(/acepta los dos términos/i)).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole('button', { name: /agregar tarjeta/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /agregar tarjeta/i }));

    await waitFor(() => expect(tokenizeCardMock).toHaveBeenCalled());
    expect(registrarMutation.mutate).not.toHaveBeenCalled();
    expect(await screen.findByText(/cerraste el formulario de wompi/i)).toBeInTheDocument();
    // La tarjeta no se agregó, pero el botón vuelve a estar disponible para reintentar.
    expect(screen.getByRole('button', { name: /agregar tarjeta/i })).not.toBeDisabled();
  });

  it('renders a 503 error from the API as the user-safe message', async () => {
    registrarMutation = { ...registrarMutation, error: new ApiError('Bad gateway', 503) };
    renderFlow({ open: true, defaultEmail: 'user@x.co' });

    expect(screen.getByText(/servicio de pagos no disponible, intenta de nuevo/i)).toBeInTheDocument();
  });

  it('renders a 400 error inline using the envelope message', async () => {
    registrarMutation = { ...registrarMutation, error: new ApiError('Invalid card token', 400) };
    renderFlow({ open: true, defaultEmail: 'user@x.co' });

    expect(screen.getByText(/invalid card token/i)).toBeInTheDocument();
  });

  it('shows a Spanish error and re-enables submit when the widget fails to load', async () => {
    tokenizeCardMock.mockRejectedValue(new Error('boom'));
    renderFlow({ open: true, defaultEmail: 'user@x.co' });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /agregar tarjeta/i }));

    expect(await screen.findByText(/no pudimos cargar el formulario de pago/i)).toBeInTheDocument();
    expect(registrarMutation.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /agregar tarjeta/i })).not.toBeDisabled();
  });

  it('ignores re-entry while tokenizing (double click opens one widget, one POST)', async () => {
    let resolveToken: (v: string) => void = () => {};
    tokenizeCardMock.mockImplementation(
      () => new Promise<string>((resolve) => { resolveToken = resolve; }),
    );
    renderFlow({ open: true, defaultEmail: 'user@x.co' });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    const btn = screen.getByRole('button', { name: /agregar tarjeta/i });
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(tokenizeCardMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(btn).toBeDisabled());

    resolveToken('tok_1');
    await waitFor(() => expect(registrarMutation.mutate).toHaveBeenCalledTimes(1));
  });

  it('keeps the checked terms when defaultEmail changes while the flow is open', () => {
    const { rerender } = renderFlow({ open: true, defaultEmail: '' });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();

    rerender(<MetodoPagoFlow open onClose={() => {}} defaultEmail="late@x.co" />);

    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
    expect(screen.getAllByRole('checkbox')[1]).toBeChecked();
  });
});
