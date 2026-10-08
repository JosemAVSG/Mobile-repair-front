import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InventarioPage } from './InventarioPage';
import { ApiError } from '../api/ApiClient';

const base = {
  descripcion: null,
  stock: 5,
  stockMinimo: 1,
  estadoStock: 'OK',
  costoUnitario: 10,
  precioVenta: 20,
  createdAt: '',
};

vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
const dialogProps = vi.hoisted(() => ({ last: null as null | { productos: { id: number }[] } }));
vi.mock('../components/organisms/MovimientoInventarioModal', () => ({
  MovimientoInventarioModal: (props: { productos: { id: number }[] }) => {
    dialogProps.last = props;
    return null;
  },
}));
vi.mock('../hooks/useQueries', () => ({
  useMarcas: () => ({ data: [] }),
  useModelos: () => ({ data: [] }),
}));
const mutation = { mutateAsync: vi.fn(), isPending: false };
const archivar = { mutateAsync: vi.fn(), isPending: false };
const restaurar = { mutateAsync: vi.fn(), isPending: false };
const eliminar = { mutateAsync: vi.fn(), isPending: false };
const movimientosSpy = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useInventory', () => ({
  useProductosInventario: (archivados = false) => ({
    data: archivados
      ? [{ ...base, id: 9, codigo: 'X-9', nombre: 'Viejo', archivado: true }]
      : [
          { ...base, id: 1, codigo: 'R-1', nombre: 'Pantalla' },
          { ...base, id: 2, codigo: 'R-2', nombre: 'Batería', stock: 0, estadoStock: 'SIN_STOCK' },
        ],
    isPending: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useInventoryKpis: () => ({ data: undefined, isPending: false, error: null }),
  useMovimientosInventario: (f: unknown) => {
    movimientosSpy(f);
    return { data: [], isPending: false, error: null, refetch: vi.fn() };
  },
  useCrearProductoInventario: () => mutation,
  useActualizarProductoInventario: () => mutation,
  useEliminarProductoInventario: () => eliminar,
  useArchivarProductoInventario: () => archivar,
  useRestaurarProductoInventario: () => restaurar,
  useCrearMovimientoInventario: () => mutation,
  useCrearCompraInventario: () => mutation,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <InventarioPage />
    </MemoryRouter>,
  );

describe('InventarioPage', () => {
  beforeEach(() => {
    movimientosSpy.mockClear();
    archivar.mutateAsync.mockReset().mockResolvedValue({});
    restaurar.mutateAsync.mockReset().mockResolvedValue({});
    eliminar.mutateAsync.mockReset().mockResolvedValue({});
    localStorage.setItem('vista-inventario', 'cards');
  });

  it('lista todos los productos sin chips de uso', () => {
    renderPage();
    expect(screen.getAllByText('Pantalla').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Batería').length).toBeGreaterThan(0);
    for (const name of ['Venta', 'Repuesto', 'Ambos']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('muestra los KPIs como Total de productos, sin gate de plan', () => {
    renderPage();
    expect(screen.getByText('Total de productos')).toBeInTheDocument();
    expect(screen.queryByText('Productos vendibles')).toBeNull();
    expect(screen.queryByText(/requieren el plan/)).toBeNull();
  });

  it('el filtro Sin stock deja solo los productos sin stock', () => {
    renderPage();
    fireEvent.change(screen.getByDisplayValue('Seleccionar...'), { target: { value: 'SIN_STOCK' } });
    expect(screen.queryAllByText('Pantalla')).toHaveLength(0);
    expect(screen.getAllByText('Batería').length).toBeGreaterThan(0);
  });

  it('la acción Historial de un producto abre la pestaña Movimientos filtrada', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Historial' })[1]);
    expect(screen.getByRole('tab', { name: 'Movimientos', selected: true })).toBeInTheDocument();
    expect(movimientosSpy).toHaveBeenLastCalledWith({ productoId: 2 });
  });

  it('las pestañas alternan entre Productos y Movimientos', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Movimientos' }));
    expect(movimientosSpy).toHaveBeenLastCalledWith({});
    fireEvent.click(screen.getByRole('tab', { name: 'Productos' }));
    expect(screen.getAllByText('Pantalla').length).toBeGreaterThan(0);
  });

  it('Archivar llama al endpoint desde el icono de la fila', async () => {
    renderPage();
    expect(screen.getAllByRole('button', { name: 'Eliminar' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Archivar' })[0]);
    await waitFor(() => expect(archivar.mutateAsync).toHaveBeenCalledWith(1));
  });

  it('Ver archivados lista los archivados, atenuados, con Restaurar y sin Movimiento', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Ver archivados'));
    expect(screen.getAllByText('Viejo').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Pantalla')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Movimiento' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Restaurar' })[0]);
    await waitFor(() => expect(restaurar.mutateAsync).toHaveBeenCalledWith(9));
  });

  it('el diálogo de movimientos nunca recibe productos archivados', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Ver archivados'));
    expect(dialogProps.last?.productos.map((p) => p.id)).toEqual([1, 2]);
  });

  it('Eliminar con 409 muestra el mensaje del backend y ofrece archivar', async () => {
    const msg = 'Este producto tiene historial; archívalo para ocultarlo';
    eliminar.mutateAsync.mockRejectedValue(new ApiError(msg, 409, { meta: { message: msg } }));
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    // El confirm del diálogo se renderiza al final del DOM.
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).slice(-1)[0]);
    expect(await screen.findByText(new RegExp(msg))).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Archivar' }).slice(-1)[0]);
    await waitFor(() => expect(archivar.mutateAsync).toHaveBeenCalledWith(1));
  });
});
