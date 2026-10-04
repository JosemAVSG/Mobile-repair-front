import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatCop, formatCurrency } from './formatters';

const norm = (s: string) => s.replace(/\s/g, ' ');

function stubLocale(lang: string) {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(lang);
}

describe('formatCop', () => {
  afterEach(() => vi.restoreAllMocks());

  it('S-BU6.1: renderiza COP aunque el navegador sea en-US (no USD)', () => {
    stubLocale('en-US');
    const out = norm(formatCop(49900));
    expect(out).toMatch(/^\$ ?49\.900$/);
    expect(out).not.toMatch(/US|USD/);
    // control: formatCurrency SI cambia con el locale (separador de miles en-US)
    expect(formatCurrency(49900)).toBe('$49,900');
  });

  it('S-BU6.2: es-CO → $99.900', () => {
    stubLocale('es-CO');
    expect(norm(formatCop(99900))).toMatch(/^\$ ?99\.900$/);
  });

  it('S-BU6.3: formatCurrency queda intacto para precios de órdenes/repuestos', () => {
    stubLocale('es-CO');
    expect(norm(formatCurrency(60000))).toMatch(/^\$ ?60\.000$/);
    stubLocale('en-US');
    expect(formatCurrency(60000)).toBe('$60,000');
  });
});
