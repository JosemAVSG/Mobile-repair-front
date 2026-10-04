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
});
