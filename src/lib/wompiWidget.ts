export const WOMPI_WIDGET_SRC = 'https://checkout.wompi.co/widget.js';

interface TokenizeOptions {
  publicKey: string;
}

// Wompi no documenta la forma exacta del callback en modo tokenize, así que se
// acepta cualquier objeto y se busca el token (tok_…) por patrón.
type WidgetResult = Record<string, unknown>;

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
      reject(new Error('Se agotó el tiempo de carga del widget de Wompi'));
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
      reject(new Error('No se pudo cargar el widget de Wompi'));
    };

    document.head.appendChild(script);
  });

  return loader;
}

const CARD_TOKEN = /^tok_/;

function idAt(value: unknown): string | null {
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

function findCardToken(value: unknown, depth = 0): string | null {
  if (typeof value === 'string') return CARD_TOKEN.test(value) ? value : null;
  if (!value || typeof value !== 'object' || depth > 4) return null;
  for (const nested of Object.values(value)) {
    const found = findCardToken(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * null = el usuario cerró el widget sin tokenizar (silencioso).
 * Lanza si el widget devolvió datos pero ninguno es un token reconocible: así el
 * flujo muestra un error en vez de quedarse quieto.
 */
function extractToken(result: WidgetResult | undefined): string | null {
  if (!result || Object.keys(result).length === 0 || 'error' in result) return null;
  const source = result.payment_source as { token?: unknown } | undefined;
  // Forma real verificada en sandbox (2026-10-04): { payment_source: { token: 'tok_…', brand, lastFour } }.
  if (typeof source?.token === 'string') return source.token;
  const known = idAt(result.token) ?? idAt(result.card) ?? idAt(result.data);
  if (known) return known;
  const found = findCardToken(result);
  if (found) return found;
  throw new Error('El widget de Wompi no devolvió un token de tarjeta reconocible');
}

export async function tokenizeCard(options: TokenizeOptions): Promise<string | null> {
  await loadWompiWidget();
  const WidgetCheckout = getWindow().WidgetCheckout;
  if (!WidgetCheckout) {
    return null;
  }

  return new Promise<string | null>((resolve, reject) => {
    const checkout = new WidgetCheckout({
      publicKey: options.publicKey,
      widgetOperation: 'tokenize',
    });
    checkout.open((result) => {
      try {
        resolve(extractToken(result));
      } catch (e) {
        reject(e);
      }
    });
  });
}
