import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useActualizarProductoInventario,
  useArchivarProductoInventario,
  useCrearCompraInventario,
  useCrearMovimientoInventario,
  useCrearProductoInventario,
  useEliminarProductoInventario,
  useProductosInventario,
  useRestaurarProductoInventario,
} from './useInventory';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
vi.mock('../api/ApiClient', () => ({ ApiClient: { get, post, put, delete: del } }));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate };
}

describe('useInventory archivados', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue([]);
    post.mockReset().mockResolvedValue({});
    put.mockReset().mockResolvedValue({});
    del.mockReset().mockResolvedValue({});
  });

  it('lista activos por defecto y archivados con archivados=true', async () => {
    const { Wrapper } = wrapper();
    renderHook(() => useProductosInventario(), { wrapper: Wrapper });
    renderHook(() => useProductosInventario(true), { wrapper: Wrapper });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get).toHaveBeenCalledWith('/api/inventario/productos');
    expect(get).toHaveBeenCalledWith('/api/inventario/productos?archivados=true');
  });

  it('no consulta si está deshabilitado', () => {
    const { Wrapper } = wrapper();
    renderHook(() => useProductosInventario(false, false), { wrapper: Wrapper });
    expect(get).not.toHaveBeenCalled();
  });

  it('archivar y restaurar llaman al endpoint e invalidan productos', async () => {
    const { Wrapper, invalidate } = wrapper();
    const a = renderHook(() => useArchivarProductoInventario(), { wrapper: Wrapper });
    await a.result.current.mutateAsync(7);
    expect(post).toHaveBeenCalledWith('/api/inventario/productos/7/archivar', {});
    const r = renderHook(() => useRestaurarProductoInventario(), { wrapper: Wrapper });
    await r.result.current.mutateAsync(7);
    expect(post).toHaveBeenCalledWith('/api/inventario/productos/7/restaurar', {});
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inventario', 'productos'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['repuestos'] });
  });

  it('movimientos y compras refrescan también el stock del selector de repuestos', async () => {
    const { Wrapper, invalidate } = wrapper();
    const mov = renderHook(() => useCrearMovimientoInventario(), { wrapper: Wrapper });
    await mov.result.current.mutateAsync({ productoId: 1, tipo: 'AJUSTE', cantidad: 1, sentido: 'ENTRADA', notas: 'x' });
    const compra = renderHook(() => useCrearCompraInventario(), { wrapper: Wrapper });
    await compra.result.current.mutateAsync({ lineas: [{ productoId: 1, cantidad: 1, costoUnitario: 1 }] });
    expect(invalidate.mock.calls.filter(([a]) => JSON.stringify(a) === JSON.stringify({ queryKey: ['repuestos'] }))).toHaveLength(2);
  });

  it('crear, actualizar y eliminar producto refrescan movimientos y kpis', async () => {
    const { Wrapper, invalidate } = wrapper();
    const keys = [
      { queryKey: ['inventario', 'productos'] },
      { queryKey: ['inventario', 'movimientos'] },
      { queryKey: ['inventario', 'kpis'] },
      { queryKey: ['repuestos'] },
    ];
    const body = { codigo: 'A', nombre: 'A', costoUnitario: 1 };
    const crear = renderHook(() => useCrearProductoInventario(), { wrapper: Wrapper });
    await crear.result.current.mutateAsync(body);
    const upd = renderHook(() => useActualizarProductoInventario(), { wrapper: Wrapper });
    await upd.result.current.mutateAsync({ id: 1, body });
    const eli = renderHook(() => useEliminarProductoInventario(), { wrapper: Wrapper });
    await eli.result.current.mutateAsync(1);
    for (const k of keys) expect(invalidate.mock.calls.filter(([a]) => JSON.stringify(a) === JSON.stringify(k))).toHaveLength(3);
  });
});
