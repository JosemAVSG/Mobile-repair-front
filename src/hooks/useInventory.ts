// ──────────────────────────────────────────────
// React Query hooks para el módulo de inventario
// ──────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../api/client';
import type {
  InventoryKpis,
  MovimientoInventario,
  MovimientoRequest,
  ProductoInventario,
  ProductoInventarioRequest,
} from '../types';

const QUERY_KEY = ['inventario'] as const;

export function useProductosInventario() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'productos'],
    queryFn: () => apiGet<ProductoInventario[]>('/api/inventario/productos'),
  });
}

export function useMovimientosInventario(productoId?: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'movimientos', productoId ?? 'todos'],
    queryFn: () =>
      apiGet<MovimientoInventario[]>(
        productoId != null
          ? `/api/inventario/movimientos?productoId=${productoId}`
          : '/api/inventario/movimientos',
      ),
    enabled: productoId == null || Number.isFinite(productoId),
  });
}

export function useInventoryKpis() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'kpis'],
    queryFn: () => apiGet<InventoryKpis>('/api/inventario/kpis'),
  });
}

export function useCrearProductoInventario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ProductoInventarioRequest) =>
      apiPost<ProductoInventario>('/api/inventario/productos', body),
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
    }) => apiPut<ProductoInventario>(`/api/inventario/productos/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'productos'] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'kpis'] });
    },
  });
}

export function useEliminarProductoInventario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiDelete<unknown>(`/api/inventario/productos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'productos'] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'kpis'] });
    },
  });
}

export function useCrearMovimientoInventario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: MovimientoRequest) =>
      apiPost<MovimientoInventario>('/api/inventario/movimientos', body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'productos'] });
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, 'movimientos'],
      });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'kpis'] });
      // Invalida también el detalle del producto afectado si existe.
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, 'movimientos', variables.productoId],
      });
    },
  });
}
