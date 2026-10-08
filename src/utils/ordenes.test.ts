import { describe, expect, it } from 'vitest';
import {
  formatNumeroOrden,
  cantidadesDeReparacion,
  cantidadesTrasCambio,
  repuestosBloqueados,
  repuestosPayload,
  totalCobradoSnapshot,
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

describe('repuestos con cantidad', () => {
  const snap = (over: Record<string, unknown>) =>
    ({ id: 1, repuestoId: null, nombre: 'x', precioCosto: 1, ...over }) as never;

  it('cantidadesDeReparacion mapea productoId -> cantidad (ausente = 1), suma repetidos e ignora legados', () => {
    const rep = {
      repuestos: [
        snap({ productoId: 1, cantidad: 2 }),
        snap({ productoId: 2 }),
        snap({ productoId: 2, cantidad: 3 }),
        snap({ repuestoId: 9 }),
      ],
    };
    expect(Array.from(cantidadesDeReparacion(rep).entries())).toEqual([
      [1, 2],
      [2, 4],
    ]);
  });

  it('cantidadesTrasCambio: agregar suma, fijar reemplaza, quitar elimina; los legados no viajan', () => {
    const rep = { repuestos: [snap({ productoId: 1, cantidad: 2 }), snap({ repuestoId: 5 })] };
    expect(repuestosPayload(cantidadesTrasCambio(rep, {}))).toEqual([{ productoId: 1, cantidad: 2 }]);
    expect(repuestosPayload(cantidadesTrasCambio(rep, { agregar: { productoId: 1, cantidad: 3 } }))).toEqual([
      { productoId: 1, cantidad: 5 },
    ]);
    expect(repuestosPayload(cantidadesTrasCambio(rep, { agregar: { productoId: 7, cantidad: 1 } }))).toEqual([
      { productoId: 1, cantidad: 2 },
      { productoId: 7, cantidad: 1 },
    ]);
    expect(repuestosPayload(cantidadesTrasCambio(rep, { fijar: { productoId: 1, cantidad: 1 } }))).toEqual([
      { productoId: 1, cantidad: 1 },
    ]);
    expect(repuestosPayload(cantidadesTrasCambio(rep, { fijar: { productoId: 1, cantidad: 0 } }))).toEqual([
      { productoId: 1, cantidad: 1 },
    ]);
    expect(repuestosPayload(cantidadesTrasCambio(rep, { quitar: 1 }))).toEqual([]);
  });

  it('totalCobradoSnapshot usa totalCobrado o unitario × cantidad', () => {
    expect(totalCobradoSnapshot(snap({ totalCobrado: 50, precioCobrado: 20, cantidad: 2 }))).toBe(50);
    expect(totalCobradoSnapshot(snap({ precioCobrado: 20, cantidad: 3 }))).toBe(60);
    expect(totalCobradoSnapshot(snap({ precioCobrado: 20 }))).toBe(20);
    expect(totalCobradoSnapshot(snap({ precioCosto: null, precioVenta: null, precioCobrado: null }))).toBeNull();
  });

  it('repuestosBloqueados solo en PAGADO y ENTREGADO', () => {
    expect(repuestosBloqueados(EstadoOrden.PAGADO)).toBe(true);
    expect(repuestosBloqueados(EstadoOrden.ENTREGADO)).toBe(true);
    expect(repuestosBloqueados(EstadoOrden.REPARACION)).toBe(false);
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
