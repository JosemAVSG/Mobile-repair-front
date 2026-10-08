import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useArchivarProductoInventario,
  useProductosInventario,
  useRestaurarProductoInventario,
} from './useInventory';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock('../api/ApiClient', () => ({ ApiClient: { get, post } }));

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
  });
});
