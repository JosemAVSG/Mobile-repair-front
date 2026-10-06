import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InventarioPage } from './InventarioPage';

const state = vi.hoisted(() => ({ habilitado: true }));

const base = {
  descripcion: null,
  stock: 5,
  stockMinimo: 1,
  estadoStock: 'OK',
  costoUnitario: 10,
  precioVenta: 20,
  controlaStock: true,
  createdAt: '',
};

vi.mock('../hooks/useInventarioHabilitado', () => ({
  useInventarioHabilitado: () => state.habilitado,
}));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../components/organisms/MovimientoInventarioModal', () => ({
  MovimientoInventarioModal: () => null,
}));
vi.mock('../hooks/useQueries', () => ({
  useMarcas: () => ({ data: [] }),
  useModelos: () => ({ data: [] }),
}));
const mutation = { mutateAsync: vi.fn(), isPending: false };
vi.mock('../hooks/useInventory', () => ({
  useProductosInventario: () => ({
    data: [
      { ...base, id: 1, codigo: 'V-1', nombre: 'Funda', uso: 'VENTA' },
      { ...base, id: 2, codigo: 'R-1', nombre: 'Pantalla', uso: 'REPUESTO' },
      { ...base, id: 3, codigo: 'A-1', nombre: 'Cable', uso: 'AMBOS' },
      {
        ...base,
        id: 4,
        codigo: 'N-1',
        nombre: 'Sinctrl',
        uso: 'REPUESTO',
        controlaStock: false,
        stock: 0,
        estadoStock: 'SIN_STOCK',
      },
    ],
    isPending: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useInventoryKpis: () => ({ data: undefined, isPending: false, error: null }),
  useCrearProductoInventario: () => mutation,
  useActualizarProductoInventario: () => mutation,
  useEliminarProductoInventario: () => mutation,
  useCrearMovimientoInventario: () => mutation,
}));

describe('InventarioPage', () => {
  beforeEach(() => {
    state.habilitado = true;
    localStorage.setItem('vista-inventario', 'cards');
  });

  const nombres = () => ['Funda', 'Pantalla', 'Cable', 'Sinctrl'].filter((n) => screen.queryAllByText(n).length);

  it('lists every uso and filters with the chips', () => {
    render(<InventarioPage />);
    expect(nombres()).toEqual(['Funda', 'Pantalla', 'Cable', 'Sinctrl']);

    fireEvent.click(screen.getByRole('button', { name: 'Repuesto' }));
    expect(nombres()).toEqual(['Pantalla', 'Sinctrl']);

    fireEvent.click(screen.getByRole('button', { name: 'Venta' }));
    expect(nombres()).toEqual(['Funda']);

    fireEvent.click(screen.getByRole('button', { name: 'Ambos' }));
    expect(nombres()).toEqual(['Cable']);

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(nombres()).toHaveLength(4);
  });

  it('shows KPIs with the inventory plan', () => {
    render(<InventarioPage />);
    expect(screen.getByText('Productos vendibles')).toBeInTheDocument();
  });

  it('hides KPIs and shows an upgrade hint without the plan', () => {
    state.habilitado = false;
    render(<InventarioPage />);
    expect(screen.queryByText('Productos vendibles')).toBeNull();
    expect(screen.getByText(/requieren el plan con ventas e inventario/)).toBeInTheDocument();
  });

  it('H2: el filtro Sin stock y el banner ignoran productos sin control de stock', () => {
    render(<InventarioPage />);
    // El banner no alerta por el producto sin control de stock.
    expect(screen.queryByText('Alertas de stock')).toBeNull();

    const select = screen.getByDisplayValue('Seleccionar...');
    fireEvent.change(select, { target: { value: 'SIN_STOCK' } });
    expect(nombres()).toEqual([]);
  });
});
