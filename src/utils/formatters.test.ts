import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatCop, formatCurrency, formatDate, formatDateTime } from './formatters';

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

describe('formatCurrency null-safety', () => {
  it('devuelve "—" para null, undefined y NaN (costos enmascarados)', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(Number.NaN)).toBe('—');
  });
});

// Los timestamps del servidor llegan como instantes UTC ("...Z"). Las expectativas se arman con
// partes de fecha LOCALES, así que no dependen de la zona horaria de la máquina.
describe('formatDate / formatDateTime con instantes UTC (Z)', () => {
  const pad = (n: number) => String(n).padStart(2, '0');

  it('formatDateTime muestra la hora local del instante', () => {
    const local = new Date(2026, 9, 7, 23, 30); // 07/10/2026 23:30 local
    const iso = local.toISOString(); // termina en Z
    expect(iso.endsWith('Z')).toBe(true);
    const out = formatDateTime(iso);
    expect(out).toContain('23:30');
    expect(out).toContain('07/10/2026');
  });

  it('formatDate usa el día local, también cerca de la medianoche', () => {
    const justAfter = new Date(2026, 9, 8, 0, 15).toISOString();
    const justBefore = new Date(2026, 9, 7, 23, 45).toISOString();
    expect(formatDate(justAfter)).toBe('08/10/2026');
    expect(formatDate(justBefore)).toBe('07/10/2026');
  });

  it('un valor naive (fechaEntrega) se muestra tal cual, sin desplazamiento', () => {
    const out = formatDateTime('2026-10-07T15:30:00');
    expect(out).toContain(`${pad(15)}:${pad(30)}`);
    expect(out).toContain('07/10/2026');
    expect(formatDate('2026-10-07T00:10:00')).toBe('07/10/2026');
  });

  it('valores inválidos devuelven "—"', () => {
    expect(formatDate('nope')).toBe('—');
    expect(formatDateTime('nope')).toBe('—');
  });
});
