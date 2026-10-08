// ──────────────────────────────────────────────
// React Query hooks para el módulo de inventario
// ──────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archivarProductoInventario,
  restaurarProductoInventario,
  createCompraInventario,
  createMovimientoInventario,
  createProductoInventario,
  deleteProductoInventario,
  getInventoryKpis,
  getMovimientosInventario,
  getProductosInventario,
  updateProductoInventario,
} from '../api/inventario';
import type {
  CompraRequest,
  MovimientoRequest,
  MovimientosFiltro,
  ProductoInventarioRequest,
} from '../types';

const QUERY_KEY = ['inventario'] as const;

/** Lista todos los productos del inventario (todo producto es un repuesto y controla stock). */
export function useProductosInventario(archivados = false, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...QUERY_KEY, 'productos', archivados ? 'archivados' : 'activos'],
    queryFn: () => getProductosInventario(archivados),
  });
}

export function useMovimientosInventario(filtro: MovimientosFiltro = {}) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'movimientos', filtro],
    queryFn: () => getMovimientosInventario(filtro),
    enabled: filtro.productoId == null || Number.isFinite(filtro.productoId),
  });
}

export function useInventoryKpis(enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'kpis'],
    queryFn: () => getInventoryKpis(),
    enabled,
  });
}

export function useCrearProductoInventario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ProductoInventarioRequest) =>
      createProductoInventario(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'productos'] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'kpis'] });
    },
  });
}

export function useActualizarProductoInventario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: ProductoInventarioRequest;
    }) => updateProductoInventario(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'productos'] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'kpis'] });
    },
  });
}

export function useEliminarProductoInventario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteProductoInventario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'productos'] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'kpis'] });
    },
  });
}

export function useArchivarProductoInventario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => archivarProductoInventario(id),
    onSuccess: () => invalidateStock(queryClient),
  });
}

export function useRestaurarProductoInventario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => restaurarProductoInventario(id),
    onSuccess: () => invalidateStock(queryClient),
  });
}

function invalidateStock(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'productos'] });
  queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'movimientos'] });
  queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'kpis'] });
}

export function useCrearMovimientoInventario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: MovimientoRequest) => createMovimientoInventario(body),
    onSuccess: () => invalidateStock(queryClient),
  });
}

export function useCrearCompraInventario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CompraRequest) => createCompraInventario(body),
    onSuccess: () => invalidateStock(queryClient),
  });
}
