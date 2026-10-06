// ──────────────────────────────────────────────
// React Query hooks para el módulo de inventario
// ──────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMovimientoInventario,
  createProductoInventario,
  deleteProductoInventario,
  getInventoryKpis,
  getMovimientosInventario,
  getProductosInventario,
  updateProductoInventario,
} from '../api/inventario';
import type { MovimientoRequest, ProductoInventarioRequest } from '../types';

const QUERY_KEY = ['inventario'] as const;

export function useProductosInventario() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'productos'],
    // Resiliencia: el backend ya excluye REPUESTO puros; si llega `uso`, filtramos igual.
    queryFn: async () => {
      const productos = await getProductosInventario();
      return productos.filter((p) => p.uso == null || p.uso === 'VENTA' || p.uso === 'AMBOS');
    },
  });
}

export function useMovimientosInventario(productoId?: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'movimientos', productoId ?? 'todos'],
    queryFn: () => getMovimientosInventario(productoId),
    enabled: productoId == null || Number.isFinite(productoId),
  });
}

export function useInventoryKpis() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'kpis'],
    queryFn: () => getInventoryKpis(),
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

export function useCrearMovimientoInventario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: MovimientoRequest) => createMovimientoInventario(body),
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