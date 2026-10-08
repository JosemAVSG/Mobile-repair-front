import { describe, expect, it } from 'vitest';
import { cantidadConSigno, etiquetaMovimiento } from './formatters';

describe('signo y etiqueta de movimientos', () => {
  it.each([
    ['USO_REPARACION', 'SALIDA', -3, 'Uso en reparación'],
    ['USO_REPARACION', 'ENTRADA', 3, 'Reposición de reparación'],
    ['USO_REPARACION', undefined, -3, 'Uso en reparación'],
    ['COMPRA', 'ENTRADA', 3, 'Compra'],
    ['COMPRA', undefined, 3, 'Compra'],
    ['AJUSTE', 'ENTRADA', 3, 'Ajuste'],
    ['AJUSTE', 'SALIDA', -3, 'Ajuste'],
  ] as const)('%s / %s -> %i "%s"', (tipo, sentido, signed, label) => {
    const m = { tipo, sentido, cantidad: 3 };
    expect(cantidadConSigno(m)).toBe(signed);
    expect(etiquetaMovimiento(m)).toBe(label);
  });
});
