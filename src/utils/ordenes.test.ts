import { describe, expect, it } from 'vitest';
import {
  formatNumeroOrden,
  idsTrasCambio,
  repuestoIdsAdjuntos,
  repuestoIdsCobrados,
  repuestosBloqueados,
  resolverTecnicoResponsable,
} from './ordenes';
import { EstadoOrden } from '../types';

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

describe('repuestos adjuntos', () => {
  const catalogo = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const snap = (over: Record<string, unknown>) =>
    ({ id: 1, repuestoId: null, nombre: 'x', precioCosto: 1, ...over }) as never;

  it('precarga solo por productoId (nunca repuestoId), sin duplicados ni ids ajenos', () => {
    const reparaciones = [
      { repuestos: [snap({ productoId: 1 }), snap({ repuestoId: 2 })] },
      { repuestos: [snap({ productoId: 1 }), snap({ productoId: 99 })] },
    ];
    expect(repuestoIdsAdjuntos(reparaciones, catalogo)).toEqual([1]);
  });

  it('idsTrasCambio no envía snapshots legados (sin productoId)', () => {
    const rep = { repuestos: [snap({ repuestoId: 2 }), snap({ productoId: 1 })] };
    expect(idsTrasCambio(rep, { agregar: 3 })).toEqual([1, 3]);
    expect(idsTrasCambio(rep, {})).toEqual([1]);
  });

  it('repuestoIdsCobrados excluye la Revisión inicial solo con descuentoDiagnostico', () => {
    const reparaciones = [
      { descripcion: 'Revisión inicial', repuestos: [snap({ productoId: 1 })] },
      { descripcion: null, repuestos: [snap({ productoId: 2 }), snap({ repuestoId: 3 })] },
    ];
    expect(Array.from(repuestoIdsCobrados(reparaciones, false))).toEqual([1, 2]);
    expect(Array.from(repuestoIdsCobrados(reparaciones, true))).toEqual([2]);
  });

  it('repuestosBloqueados solo en PAGADO y ENTREGADO', () => {
    expect(repuestosBloqueados(EstadoOrden.PAGADO)).toBe(true);
    expect(repuestosBloqueados(EstadoOrden.ENTREGADO)).toBe(true);
    expect(repuestosBloqueados(EstadoOrden.REPARACION)).toBe(false);
  });

  it('idsTrasCambio devuelve el conjunto final sin duplicados', () => {
    const rep = { repuestos: [snap({ productoId: 1 }), snap({ productoId: 2 })] };
    expect(idsTrasCambio(rep, { agregar: 2 })).toEqual([1, 2]);
    expect(idsTrasCambio(rep, { agregar: 3 })).toEqual([1, 2, 3]);
    expect(idsTrasCambio(rep, { quitar: 1 })).toEqual([2]);
  });
});

describe('resolverTecnicoResponsable', () => {
  const user = { id: 7, nombre: 'Tec', correo: 't@x.com', tecnicoId: 7 };

  it('null sin tecnicoId', () => {
    expect(resolverTecnicoResponsable(null, [], user)).toBeNull();
  });

  it('usa la lista (ADMIN) cuando está', () => {
    expect(resolverTecnicoResponsable(3, [{ id: 3, nombre: 'Ana' }], user)?.nombre).toBe('Ana');
  });

  it('resuelve desde la sesión cuando la lista no llega (TECNICO)', () => {
    expect(resolverTecnicoResponsable(7, undefined, user)).toMatchObject({ nombre: 'Tec' });
  });

  it('prefiere tecnicoNombre de la orden, pero conserva el correo conocido', () => {
    expect(resolverTecnicoResponsable(3, [{ id: 3, nombre: 'Ana', correo: 'a@x.com' }], user, 'Ana B')).toEqual({
      id: 3,
      nombre: 'Ana B',
      correo: 'a@x.com',
    });
    expect(resolverTecnicoResponsable(5, undefined, user, 'Otro')).toMatchObject({ nombre: 'Otro', correo: null });
  });

  it('nunca devuelve null si hay tecnicoId no resoluble', () => {
    expect(resolverTecnicoResponsable(5, undefined, user)).not.toBeNull();
  });
});
