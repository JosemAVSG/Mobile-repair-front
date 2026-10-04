import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWompiWidget, tokenizeCard, WOMPI_WIDGET_SRC, __resetWompiWidgetForTests } from './wompiWidget';

const scripts = () => Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="wompi"]'));

beforeEach(() => {
  __resetWompiWidgetForTests();
  document.head.querySelectorAll('script[src*="wompi"]').forEach((s) => s.remove());
  delete (window as { WidgetCheckout?: unknown }).WidgetCheckout;
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as { WidgetCheckout?: unknown }).WidgetCheckout;
});

describe('wompiWidget (R-UI3, ADR-W12)', () => {
  it('S-UI3.5: the widget script is loaded on demand, never present in the initial document', () => {
    expect(scripts()).toHaveLength(0);
  });

  it('does not inject anything until requested, and injects only once (memoized promise)', async () => {
    expect(scripts()).toHaveLength(0);
    const p1 = loadWompiWidget();
    const p2 = loadWompiWidget();
    expect(p1).toBe(p2);
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].src).toBe(WOMPI_WIDGET_SRC);
    expect(WOMPI_WIDGET_SRC).toBe('https://checkout.wompi.co/widget.js');
    scripts()[0].dispatchEvent(new Event('load'));
    await expect(p1).resolves.toBeUndefined();
  });

  it('rejects if the script fails and allows retry', async () => {
    const p = loadWompiWidget();
    scripts()[0].dispatchEvent(new Event('error'));
    await expect(p).rejects.toThrow(/widget/i);
    const retry = loadWompiWidget();
    expect(retry).not.toBe(p);
  });

  it('rejects after 15s without loading', async () => {
    vi.useFakeTimers();
    const p = loadWompiWidget();
    const assertion = expect(p).rejects.toThrow(/tiempo de carga/i);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  function fakeWidget(result: unknown) {
    const open = vi.fn((cb: (r: unknown) => void) => cb(result));
    const ctor = vi.fn(() => ({ open }));
    (window as unknown as { WidgetCheckout: unknown }).WidgetCheckout = ctor;
    return { ctor, open };
  }

  it('tokenizeCard opens the widget in tokenize mode with the public key and resolves the token', async () => {
    const { ctor } = fakeWidget({ token: { id: 'tok_test_123' } });
    const token = await tokenizeCard({ publicKey: 'pub_test_abc' });
    expect(token).toBe('tok_test_123');
    expect(ctor).toHaveBeenCalledWith({ publicKey: 'pub_test_abc', widgetOperation: 'tokenize' });
  });

  it('S-UI3.3: closing without token resolves null silently', async () => {
    fakeWidget(undefined);
    await expect(tokenizeCard({ publicKey: 'pub_test_abc' })).resolves.toBeNull();
    fakeWidget({ error: 'closed' });
    await expect(tokenizeCard({ publicKey: 'pub_test_abc' })).resolves.toBeNull();
  });

  it('resolves the token from the real sandbox callback shape (payment_source.token)', async () => {
    fakeWidget({
      payment_source: {
        token: 'tok_test_2211259_73155f3d7D1058e1C2bBA9f531c788fd',
        type: 'CARD',
        cardHolder: 'Charles Wilson',
        lastFour: '5786',
        brand: 'MASTERCARD',
        name: 'MASTERCARD-5786',
      },
    });
    await expect(tokenizeCard({ publicKey: 'pub_test_abc' })).resolves.toBe(
      'tok_test_2211259_73155f3d7D1058e1C2bBA9f531c788fd',
    );
  });

  it('rejects when an async widget callback carries no recognizable token', async () => {
    const open = vi.fn((cb: (r: unknown) => void) => setTimeout(() => cb({ transaction: { id: 'x' } }), 0));
    (window as unknown as { WidgetCheckout: unknown }).WidgetCheckout = vi.fn(() => ({ open }));
    await expect(tokenizeCard({ publicKey: 'pub_test_abc' })).rejects.toThrow(/token/i);
  });

  it.each([
    ['card.id', { card: { id: 'tok_test_card' } }, 'tok_test_card'],
    ['data.id (tokens API shape)', { status: 'CREATED', data: { id: 'tok_test_data', last_four: '5786' } }, 'tok_test_data'],
    ['top-level id', { id: 'tok_test_top' }, 'tok_test_top'],
    ['nested unknown key', { payload: { result: { cardToken: 'tok_test_deep' } } }, 'tok_test_deep'],
  ])('resolves the token when the widget returns it in %s', async (_label, result, expected) => {
    fakeWidget(result);
    await expect(tokenizeCard({ publicKey: 'pub_test_abc' })).resolves.toBe(expected);
  });

  it('rejects (never silent) when the widget returns data without a recognizable token', async () => {
    fakeWidget({ transaction: { id: '123-abc', status: 'APPROVED' } });
    await expect(tokenizeCard({ publicKey: 'pub_test_abc' })).rejects.toThrow(/token/i);
  });

  it('does not log card data or the token', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    fakeWidget({ token: { id: 'tok_secret' } });
    await tokenizeCard({ publicKey: 'pub_test_abc' });
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
    spies.forEach((s) => s.mockRestore());
  });

  it('does not inject the script again if WidgetCheckout already exists', async () => {
    fakeWidget({ token: { id: 't' } });
    await tokenizeCard({ publicKey: 'pub_test_abc' });
    expect(scripts()).toHaveLength(0);
  });

  it('resolves null when the widget iframe is dismissed without calling the callback', async () => {
    const open = vi.fn(() => {
      const frame = document.createElement('iframe');
      frame.src = 'https://checkout.wompi.co/p/';
      document.body.appendChild(frame);
      setTimeout(() => frame.remove(), 0);
    });
    (window as unknown as { WidgetCheckout: unknown }).WidgetCheckout = vi.fn(() => ({ open }));

    await expect(tokenizeCard({ publicKey: 'pub_test_abc' })).resolves.toBeNull();
  });
});
