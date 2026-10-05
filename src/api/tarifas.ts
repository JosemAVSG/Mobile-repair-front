import { ApiClient } from './ApiClient';
import type {
  TarifaManoObra,
  TarifaManoObraRequest,
  TipoReparacion,
} from '../types';

export const getTarifas = async (
  tipo?: TipoReparacion,
): Promise<TarifaManoObra[]> => {
  const endpoint = tipo
    ? `/api/tarifas-mano-obra?tipo=${encodeURIComponent(tipo)}`
    : '/api/tarifas-mano-obra';
  return ApiClient.get<TarifaManoObra[]>(endpoint);
};

export const createTarifa = async (
  body: TarifaManoObraRequest,
): Promise<TarifaManoObra> => {
  return ApiClient.post<TarifaManoObra>('/api/tarifas-mano-obra', body);
};

export const updateTarifa = async (
  id: number,
  body: TarifaManoObraRequest,
): Promise<TarifaManoObra> => {
  return ApiClient.put<TarifaManoObra>(`/api/tarifas-mano-obra/${id}`, body);
};

export const deleteTarifa = async (id: number): Promise<unknown> => {
  return ApiClient.delete(`/api/tarifas-mano-obra/${id}`);
};

export interface ResolverPrecioTarifaParams {
  tipo: TipoReparacion;
  marcaId?: number | null;
  modeloId?: number | null;
}

/**
 * Precio resuelto por especificidad (modelo > marca > genérico).
 * Devuelve `null` cuando no hay ninguna tarifa aplicable.
 */
export const resolverPrecioTarifa = async ({
  tipo,
  marcaId,
  modeloId,
}: ResolverPrecioTarifaParams): Promise<number | null> => {
  const params = new URLSearchParams({ tipo });
  if (marcaId != null) params.set('marcaId', String(marcaId));
  if (modeloId != null) params.set('modeloId', String(modeloId));
  return ApiClient.get<number | null>(
    `/api/tarifas-mano-obra/precio?${params.toString()}`,
  );
};
