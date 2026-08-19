// ──────────────────────────────────────────────
// React Query hooks por entidad
// Cada hook encapsula queryKey + queryFn.
// ──────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';
import type {
  Cliente,
  Dispositivo,
  HistorialEntry,
  Marca,
  Modelo,
  OrdenTrabajo,
  Repuesto,
  Tarifa,
} from '../types';

export function useMarcas() {
  return useQuery({
    queryKey: ['marcas'],
    queryFn: () => apiGet<Marca[]>('/api/marcas'),
  });
}

export function useModelos() {
  return useQuery({
    queryKey: ['modelos'],
    queryFn: () => apiGet<Modelo[]>('/api/modelos'),
  });
}

export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: () => apiGet<Cliente[]>('/api/clientes'),
  });
}

export function useCliente(id?: number) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: () => apiGet<Cliente>(`/api/clientes/${id}`),
    enabled: id != null && Number.isFinite(id),
  });
}

export function useDispositivos() {
  return useQuery({
    queryKey: ['dispositivos'],
    queryFn: () => apiGet<Dispositivo[]>('/api/dispositivos'),
  });
}

export function useDispositivosPorCliente(clienteId?: number) {
  return useQuery({
    queryKey: ['dispositivos', 'cliente', clienteId],
    queryFn: () => apiGet<Dispositivo[]>(`/api/dispositivos/cliente/${clienteId}`),
    enabled: clienteId != null && Number.isFinite(clienteId),
  });
}

export function useDispositivo(id?: number) {
  return useQuery({
    queryKey: ['dispositivos', id],
    queryFn: () => apiGet<Dispositivo>(`/api/dispositivos/${id}`),
    enabled: id != null && Number.isFinite(id),
  });
}

export function useModelo(id?: number) {
  return useQuery({
    queryKey: ['modelos', id],
    queryFn: () => apiGet<Modelo>(`/api/modelos/${id}`),
    enabled: id != null && Number.isFinite(id),
  });
}

export function useOrdenes(estado?: string) {
  const queryKey = estado ? ['ordenes', 'estado', estado] : ['ordenes'];
  return useQuery({
    queryKey,
    queryFn: () =>
      apiGet<OrdenTrabajo[]>(estado ? `/api/ordenes/estado/${estado}` : '/api/ordenes'),
  });
}

export function useOrden(id?: number) {
  return useQuery({
    queryKey: ['ordenes', id],
    queryFn: () => apiGet<OrdenTrabajo>(`/api/ordenes/${id}`),
    enabled: id != null && Number.isFinite(id),
  });
}

export function useHistorialOrden(ordenId?: number) {
  return useQuery({
    queryKey: ['historial', 'ORDEN', ordenId],
    queryFn: () => apiGet<HistorialEntry[]>(`/api/historial/ORDEN/${ordenId}`),
    enabled: ordenId != null && Number.isFinite(ordenId),
  });
}

export function useRepuestos() {
  return useQuery({
    queryKey: ['repuestos'],
    queryFn: () => apiGet<Repuesto[]>('/api/repuestos'),
  });
}

export function useRepuestosBajoStock() {
  return useQuery({
    queryKey: ['repuestos', 'bajo-stock'],
    queryFn: () => apiGet<Repuesto[]>('/api/repuestos/bajo-stock'),
  });
}

export interface TarifaFiltro {
  verActivas?: boolean;
  marcaId?: string;
  modeloId?: string;
}

export function useTarifas(filtro?: TarifaFiltro) {
  const verActivas = filtro?.verActivas;
  const marcaId = filtro?.marcaId;
  const modeloId = filtro?.modeloId;

  const queryKey = verActivas
    ? ['tarifas', 'activas']
    : marcaId
      ? ['tarifas', 'marca', marcaId]
      : modeloId
        ? ['tarifas', 'modelo', modeloId]
        : ['tarifas'];

  const endpoint = verActivas
    ? '/api/tarifas/activas'
    : marcaId
      ? `/api/tarifas/marca/${marcaId}`
      : modeloId
        ? `/api/tarifas/modelo/${modeloId}`
        : '/api/tarifas';

  return useQuery({
    queryKey,
    queryFn: () => apiGet<Tarifa[]>(endpoint),
  });
}
