import { describe, expect, it } from 'vitest';
import { formatNumeroOrden } from './ordenes';

describe('formatNumeroOrden', () => {
  it('usa el numeroOrden por taller cuando viene del backend', () => {
    expect(formatNumeroOrden({ id: 987, numeroOrden: '0001' })).toBe('0001');
  });

  it('cae al id con 4 dígitos cuando no hay numeroOrden', () => {
    expect(formatNumeroOrden({ id: 7 })).toBe('0007');
    expect(formatNumeroOrden({ id: 7, numeroOrden: null })).toBe('0007');
    expect(formatNumeroOrden({ id: 7, numeroOrden: '  ' })).toBe('0007');
  });

  it('no trunca ids de más de 4 dígitos', () => {
    expect(formatNumeroOrden({ id: 12345 })).toBe('12345');
  });
});
