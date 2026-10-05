// ──────────────────────────────────────────────
// React Query hooks por entidad
// Cada hook encapsula queryKey + queryFn.
// ──────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCliente, getClientes } from '../api/clientes';
import { getMarcas } from '../api/marcas';
import { getModelo, getModelos } from '../api/modelos';
import {
  deleteFoto,
  getFotosOrden,
  getHistorialOrden,
  getOrden,
  getOrdenes,
  uploadFotoOrden,
  type OrdenesFiltro,
} from '../api/ordenes';
import { getRepuestos } from '../api/repuestos';
import { getTarifas } from '../api/tarifas';
import { getTecnicos } from '../api/tecnicos';
import type { EtapaFoto, TipoReparacion } from '../types';

export function useMarcas() {
  return useQuery({
    queryKey: ['marcas'],
    queryFn: () => getMarcas(),
  });
}

export function useModelos() {
  return useQuery({
    queryKey: ['modelos'],
    queryFn: () => getModelos(),
  });
}

export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: () => getClientes(),
  });
}

export function useTecnicos() {
  return useQuery({
    queryKey: ['tecnicos'],
    queryFn: () => getTecnicos(),
  });
}

export function useCliente(id?: number) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: () => getCliente(id!),
    enabled: id != null && Number.isFinite(id),
  });
}

export function useModelo(id?: number) {
  return useQuery({
    queryKey: ['modelos', id],
    queryFn: () => getModelo(id!),
    enabled: id != null && Number.isFinite(id),
  });
}

export function useOrdenes(estado?: string, filtro?: OrdenesFiltro, enabled = true) {
  const queryKey: unknown[] = ['ordenes'];

  if (estado) {
    queryKey.push('estado', estado);
  } else if (filtro?.sinTecnico) {
    queryKey.push('sinTecnico', true);
  } else if (filtro?.tecnicoId != null) {
    queryKey.push('tecnicoId', filtro.tecnicoId);
  }

  return useQuery({
    queryKey,
    queryFn: () => getOrdenes(estado, filtro),
    enabled,
  });
}

export function useOrden(id?: number) {
  return useQuery({
    queryKey: ['ordenes', id],
    queryFn: () => getOrden(id!),
    enabled: id != null && Number.isFinite(id),
  });
}

export function useHistorialOrden(ordenId?: number) {
  return useQuery({
    queryKey: ['historial', 'ORDEN', ordenId],
    queryFn: () => getHistorialOrden(ordenId!),
    enabled: ordenId != null && Number.isFinite(ordenId),
  });
}

export function useRepuestos(nombre?: string) {
  return useQuery({
    queryKey: nombre ? ['repuestos', 'nombre', nombre] : ['repuestos'],
    queryFn: () => getRepuestos(nombre),
  });
}

export function useTarifas(tipo?: TipoReparacion) {
  return useQuery({
    queryKey: tipo ? ['tarifas', 'tipo', tipo] : ['tarifas'],
    queryFn: () => getTarifas(tipo),
  });
}

export function useFotosOrden(ordenId?: number) {
  return useQuery({
    queryKey: ['fotos', 'orden', ordenId],
    queryFn: () => getFotosOrden(ordenId!),
    enabled: ordenId != null && Number.isFinite(ordenId),
  });
}

export function useSubirFotoOrden(ordenId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, etapa }: { file: File; etapa: EtapaFoto }) =>
      uploadFotoOrden(ordenId!, file, etapa),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fotos', 'orden', ordenId] });
    },
  });
}

export function useEliminarFotoOrden(ordenId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fotoId: number) => deleteFoto(fotoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fotos', 'orden', ordenId] });
    },
  });
}