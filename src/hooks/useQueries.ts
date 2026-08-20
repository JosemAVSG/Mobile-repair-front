// ──────────────────────────────────────────────
// React Query hooks por entidad
// Cada hook encapsula queryKey + queryFn.
// ──────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPostForm } from '../api/client';
import type {
  Cliente,
  Dispositivo,
  EtapaFoto,
  FotoOrden,
  HistorialEntry,
  Marca,
  Modelo,
  OrdenTrabajo,
  Repuesto,
  Tarifa,
  Tecnico,
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

export function useTecnicos() {
  return useQuery({
    queryKey: ['tecnicos'],
    queryFn: () => apiGet<Tecnico[]>('/api/tecnicos'),
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

/** Filtros adicionales del listado de órdenes (GET /api/ordenes?tecnicoId=X
 *  o ?sinTecnico=true). Solo se aplican cuando no se filtra por estado. */
export interface OrdenesFiltro {
  tecnicoId?: number;
  sinTecnico?: boolean;
}

export function useOrdenes(estado?: string, filtro?: OrdenesFiltro, enabled = true) {
  const queryKey: unknown[] = ['ordenes'];
  let endpoint = '/api/ordenes';

  if (estado) {
    queryKey.push('estado', estado);
    endpoint = `/api/ordenes/estado/${estado}`;
  } else if (filtro?.sinTecnico) {
    queryKey.push('sinTecnico', true);
    endpoint = '/api/ordenes?sinTecnico=true';
  } else if (filtro?.tecnicoId != null) {
    queryKey.push('tecnicoId', filtro.tecnicoId);
    endpoint = `/api/ordenes?tecnicoId=${filtro.tecnicoId}`;
  }

  return useQuery({
    queryKey,
    queryFn: () => apiGet<OrdenTrabajo[]>(endpoint),
    enabled,
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

export function useRepuestos(nombre?: string) {
  return useQuery({
    queryKey: nombre ? ['repuestos', 'nombre', nombre] : ['repuestos'],
    queryFn: () =>
      apiGet<Repuesto[]>(
        nombre ? `/api/repuestos?nombre=${encodeURIComponent(nombre)}` : '/api/repuestos',
      ),
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

export function useFotosOrden(ordenId?: number) {
  return useQuery({
    queryKey: ['fotos', 'orden', ordenId],
    queryFn: () => apiGet<FotoOrden[]>(`/api/ordenes/${ordenId}/fotos`),
    enabled: ordenId != null && Number.isFinite(ordenId),
  });
}

export function useSubirFotoOrden(ordenId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, etapa }: { file: File; etapa: EtapaFoto }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('etapa', etapa);
      return apiPostForm<FotoOrden>(`/api/ordenes/${ordenId}/fotos`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fotos', 'orden', ordenId] });
    },
  });
}

export function useEliminarFotoOrden(ordenId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fotoId: number) => apiDelete<unknown>(`/api/fotos/${fotoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fotos', 'orden', ordenId] });
    },
  });
}
