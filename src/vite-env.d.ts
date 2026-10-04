/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Dominio público para los QR de los tickets (ej: https://repair.jglabs.tech) */
  readonly VITE_PUBLIC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export interface WompiWidgetResult {
  token?: { id?: string } | null;
  error?: unknown;
}

export interface WompiWidgetCheckout {
  open: (callback: (result: WompiWidgetResult | undefined) => void) => void;
}

export interface WompiWidgetCheckoutConstructor {
  new (options: { publicKey: string; widgetOperation: 'tokenize' }): WompiWidgetCheckout;
}

declare global {
  interface Window {
    WidgetCheckout?: WompiWidgetCheckoutConstructor | undefined;
  }
}
