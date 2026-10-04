export const WOMPI_WIDGET_SRC = 'https://checkout.wompi.co/widget.js';

interface TokenizeOptions {
  publicKey: string;
}

interface WidgetResult {
  token?: { id?: string } | null;
  error?: unknown;
}

interface WidgetCheckout {
  open: (callback: (result: WidgetResult | undefined) => void) => void;
}

interface WidgetCheckoutConstructor {
  new (options: { publicKey: string; widgetOperation: 'tokenize' }): WidgetCheckout;
}

let loader: Promise<void> | null = null;

function getWindow() {
  return window as unknown as { WidgetCheckout?: WidgetCheckoutConstructor };
}

function removeScript(): void {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${WOMPI_WIDGET_SRC}"]`);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}

export function __resetWompiWidgetForTests(): void {
  loader = null;
}

export function loadWompiWidget(): Promise<void> {
  if (loader) {
    return loader;
  }

  const w = getWindow();
  if (w.WidgetCheckout) {
    loader = Promise.resolve();
    return loader;
  }

  loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WOMPI_WIDGET_SRC;
    script.async = true;

    const timeout = window.setTimeout(() => {
      cleanup();
      loader = null;
      removeScript();
      reject(new Error('Wompi widget load timed out'));
    }, 15_000);

    const cleanup = () => {
      script.onload = null;
      script.onerror = null;
      window.clearTimeout(timeout);
    };

    script.onload = () => {
      cleanup();
      resolve();
    };

    script.onerror = () => {
      cleanup();
      loader = null;
      removeScript();
      reject(new Error('Failed to load Wompi widget'));
    };

    document.head.appendChild(script);
  });

  return loader;
}

function extractToken(result: WidgetResult | undefined): string | null {
  if (!result) return null;
  if (typeof result.token?.id === 'string') return result.token.id;
  return null;
}

export async function tokenizeCard(options: TokenizeOptions): Promise<string | null> {
  await loadWompiWidget();
  const WidgetCheckout = getWindow().WidgetCheckout;
  if (!WidgetCheckout) {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    const checkout = new WidgetCheckout({
      publicKey: options.publicKey,
      widgetOperation: 'tokenize',
    });
    checkout.open((result) => {
      resolve(extractToken(result));
    });
  });
}
