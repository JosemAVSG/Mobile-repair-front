import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MovimientosHistorial } from './MovimientosHistorial';
import type { MovimientosFiltro, ProductoInventario } from '../../types';

const hook = vi.hoisted(() => ({ useMovimientosInventario: vi.fn() }));
vi.mock('../../hooks/useInventory', () => hook);

const productos = [
  { id: 1, codigo: 'P-1', nombre: 'Pantalla' },
  { id: 2, codigo: 'B-1', nombre: 'Batería' },
] as unknown as ProductoInventario[];

const movs = [
  {
    id: 10,
    productoId: 1,
    tipo: 'USO_REPARACION',
    sentido: 'SALIDA',
    cantidad: 2,
    stockResultante: 3,
    ordenId: 77,
    costoUnitario: 100,
    usuario: 'ana',
    createdAt: '2026-10-01T10:00:00',
  },
  {
    id: 11,
    productoId: 2,
    tipo: 'AJUSTE',
    sentido: 'SALIDA',
    cantidad: 1,
    stockResultante: 4,
    ordenId: null,
    costoUnitario: 50,
    usuario: 'luis',
    notas: 'Conteo',
    createdAt: '2026-10-02T10:00:00',
  },
  {
    id: 12,
    productoId: 1,
    tipo: 'USO_REPARACION',
    sentido: 'ENTRADA',
    cantidad: 4,
    stockResultante: 7,
    ordenId: 77,
    costoUnitario: 100,
    usuario: 'marta',
    notas: 'Reposición: repuesto quitado de la orden',
    createdAt: '2026-10-03T10:00:00',
  },
  {
    id: 13,
    productoId: 2,
    tipo: 'COMPRA',
    sentido: 'ENTRADA',
    cantidad: 6,
    stockResultante: 10,
    ordenId: null,
    costoUnitario: 50,
    usuario: 'pepe',
    createdAt: '2026-10-04T10:00:00',
  },
  {
    id: 14,
    productoId: 2,
    tipo: 'AJUSTE',
    sentido: 'ENTRADA',
    cantidad: 8,
    stockResultante: 18,
    ordenId: null,
    costoUnitario: 50,
    usuario: 'lola',
    createdAt: '2026-10-05T10:00:00',
  },
];

function setup(filtro: MovimientosFiltro = {}) {
  const onFiltroChange = vi.fn();
  render(
    <MemoryRouter>
      <MovimientosHistorial productos={productos} filtro={filtro} onFiltroChange={onFiltroChange} />
    </MemoryRouter>,
  );
  return onFiltroChange;
}

describe('MovimientosHistorial', () => {
  beforeEach(() => {
    hook.useMovimientosInventario.mockReset();
    hook.useMovimientosInventario.mockReturnValue({
      data: movs,
      isPending: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('muestra producto, tipo, cantidad con signo, usuario y enlace a la orden', () => {
    setup();
    expect(screen.getAllByText('P-1 · Pantalla', { selector: 'td' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Uso en reparación', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument(); // AJUSTE/SALIDA resta
    expect(screen.getByText('ana')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Orden #77' })[0]).toHaveAttribute('href', '/reparaciones/77');
  });

  it('el signo y la etiqueta de USO_REPARACION salen del sentido (SALIDA uso, ENTRADA reposición)', () => {
    setup();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('Uso en reparación', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
    expect(screen.getByText('Reposición de reparación', { selector: 'span' })).toBeInTheDocument();
  });

  it('COMPRA y AJUSTE de ENTRADA suman', () => {
    setup();
    expect(screen.getByText('+6')).toBeInTheDocument();
    expect(screen.getByText('+8')).toBeInTheDocument();
  });

  it('muestra productoNombre del backend (producto archivado) antes que el lookup', () => {
    hook.useMovimientosInventario.mockReturnValue({
      data: [
        { id: 20, productoId: 99, productoNombre: 'Archivado Q', tipo: 'COMPRA', sentido: 'ENTRADA', cantidad: 1, createdAt: '2026-10-01T10:00:00' },
        { id: 21, productoId: 98, tipo: 'COMPRA', sentido: 'ENTRADA', cantidad: 1, createdAt: '2026-10-01T10:00:00' },
      ],
      isPending: false,
      error: null,
      refetch: vi.fn(),
    });
    setup();
    expect(screen.getByText('Archivado Q', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('#98', { selector: 'td' })).toBeInTheDocument();
  });

  it('consulta con el filtro recibido', () => {
    const filtro = { productoId: 2, tipo: 'COMPRA', desde: '2026-10-01', hasta: '2026-10-31' } as const;
    setup(filtro);
    expect(hook.useMovimientosInventario).toHaveBeenCalledWith(filtro);
  });

  it('emite cambios de producto, tipo y fechas', () => {
    const onFiltroChange = setup({ tipo: 'AJUSTE' });
    fireEvent.change(screen.getByLabelText('Filtrar por producto'), { target: { value: '2' } });
    expect(onFiltroChange).toHaveBeenLastCalledWith({ tipo: 'AJUSTE', productoId: 2 });
    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: 'COMPRA' } });
    expect(onFiltroChange).toHaveBeenLastCalledWith({ tipo: 'COMPRA' });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    expect(onFiltroChange).toHaveBeenLastCalledWith({ tipo: 'AJUSTE', desde: '2026-10-01' });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-31' } });
    expect(onFiltroChange).toHaveBeenLastCalledWith({ tipo: 'AJUSTE', hasta: '2026-10-31' });
  });

  it('limpia los filtros', () => {
    const onFiltroChange = setup({ productoId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(onFiltroChange).toHaveBeenCalledWith({});
  });
});
