import { ApiClient } from './ApiClient';
import type {
  InventoryKpis,
  MovimientoInventario,
  MovimientoRequest,
  ProductoInventario,
  ProductoInventarioRequest,
  UsoProducto,
} from '../types';

export const getProductosInventario = async (
  uso?: UsoProducto,
): Promise<ProductoInventario[]> => {
  const endpoint = uso
    ? `/api/inventario/productos?uso=${uso}`
    : '/api/inventario/productos';
  return ApiClient.get<ProductoInventario[]>(endpoint);
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
  productoId?: number,
): Promise<MovimientoInventario[]> => {
  const endpoint =
    productoId != null
      ? `/api/inventario/movimientos?productoId=${productoId}`
      : '/api/inventario/movimientos';
  return ApiClient.get<MovimientoInventario[]>(endpoint);
};

export const createMovimientoInventario = async (
  body: MovimientoRequest,
): Promise<MovimientoInventario> => {
  return ApiClient.post<MovimientoInventario>('/api/inventario/movimientos', body);
};

export const getInventoryKpis = async (): Promise<InventoryKpis> => {
  return ApiClient.get<InventoryKpis>('/api/inventario/kpis');
};