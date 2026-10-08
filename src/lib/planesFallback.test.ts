import { describe, expect, it } from 'vitest';
import { PLANES_FALLBACK } from './planesFallback';

describe('PLANES_FALLBACK', () => {
  const textos = (plan: string) => PLANES_FALLBACK.find((p) => p.plan === plan)?.features.join(' | ') ?? '';

  it('Básico permite 3 técnicos incluido el administrador, con inventario', () => {
    expect(textos('BASICO')).toMatch(/Hasta 3 técnicos \(incluido el administrador\)/);
    expect(textos('BASICO')).toMatch(/Inventario/);
  });

  it('Pro permite 8 técnicos incluido el administrador, con métricas avanzadas', () => {
    expect(textos('PRO')).toMatch(/Hasta 8 técnicos \(incluido el administrador\)/);
    expect(textos('PRO')).toMatch(/Métricas avanzadas/);
  });

  it('no expone Business ni límites viejos', () => {
    expect(PLANES_FALLBACK.map((p) => p.plan)).toEqual(['BASICO', 'PRO']);
    expect(JSON.stringify(PLANES_FALLBACK)).not.toMatch(/business|ilimitad|hasta 2/i);
  });
});
