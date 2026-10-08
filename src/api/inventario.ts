import { ApiClient } from './ApiClient';
import type {
  InventoryKpis,
  MovimientoInventario,
  MovimientoRequest,
  ProductoInventario,
  ProductoInventarioRequest,
  CompraRequest,
  MovimientosFiltro,
} from '../types';

export const getProductosInventario = async (
  archivados = false,
): Promise<ProductoInventario[]> => {
  return ApiClient.get<ProductoInventario[]>(
    archivados ? '/api/inventario/productos?archivados=true' : '/api/inventario/productos',
  );
};

export const archivarProductoInventario = async (id: number): Promise<ProductoInventario> => {
  return ApiClient.post<ProductoInventario>(`/api/inventario/productos/${id}/archivar`, {});
};

export const restaurarProductoInventario = async (id: number): Promise<ProductoInventario> => {
  return ApiClient.post<ProductoInventario>(`/api/inventario/productos/${id}/restaurar`, {});
};

export const createProductoInventario = async (
  body: ProductoInventarioRequest,
): Promise<ProductoInventario> => {
  return ApiClient.post<ProductoInventario>('/api/inventario/productos', body);
};

export const updateProductoInventario = async (
  id: number,
  body: ProductoInventarioRequest,
): Promise<ProductoInventario> => {
  return ApiClient.put<ProductoInventario>(`/api/inventario/productos/${id}`, body);
};

export const deleteProductoInventario = async (id: number): Promise<unknown> => {
  return ApiClient.delete(`/api/inventario/productos/${id}`);
};

export const getMovimientosInventario = async (
  filtro: MovimientosFiltro = {},
): Promise<MovimientoInventario[]> => {
  const params = new URLSearchParams();
  if (filtro.productoId != null) params.set('productoId', String(filtro.productoId));
  if (filtro.tipo) params.set('tipo', filtro.tipo);
  if (filtro.desde) params.set('desde', filtro.desde);
  if (filtro.hasta) params.set('hasta', filtro.hasta);
  if (filtro.limit != null) params.set('limit', String(filtro.limit));
  const qs = params.toString();
  return ApiClient.get<MovimientoInventario[]>(
    qs ? `/api/inventario/movimientos?${qs}` : '/api/inventario/movimientos',
  );
};

export const createMovimientoInventario = async (
  body: MovimientoRequest,
): Promise<MovimientoInventario> => {
  return ApiClient.post<MovimientoInventario>('/api/inventario/movimientos', body);
};

export const createCompraInventario = async (
  body: CompraRequest,
): Promise<MovimientoInventario[]> => {
  return ApiClient.post<MovimientoInventario[]>('/api/inventario/compras', body);
};

export const getInventoryKpis = async (): Promise<InventoryKpis> => {
  return ApiClient.get<InventoryKpis>('/api/inventario/kpis');
};