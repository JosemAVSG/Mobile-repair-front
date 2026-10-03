import { ApiClient } from './ApiClient';
import type {
  EtapaFoto,
  EstadoOrden,
  FotoOrden,
  HistorialEntry,
  OrdenRequest,
  OrdenTrabajo,
  PublicRepairStatus,
  Reparacion,
  ReparacionRequest,
} from '../types';

/** Filtros adicionales del listado de órdenes (GET /api/ordenes?tecnicoId=X
 *  o ?sinTecnico=true). Solo se aplican cuando no se filtra por estado. */
export interface OrdenesFiltro {
  tecnicoId?: number;
  sinTecnico?: boolean;
}

export const getOrdenes = async (
  estado?: string,
  filtro?: OrdenesFiltro,
): Promise<OrdenTrabajo[]> => {
  let endpoint = '/api/ordenes';

  if (estado) {
    endpoint = `/api/ordenes/estado/${estado}`;
  } else if (filtro?.sinTecnico) {
    endpoint = '/api/ordenes?sinTecnico=true';
  } else if (filtro?.tecnicoId != null) {
    endpoint = `/api/ordenes?tecnicoId=${filtro.tecnicoId}`;
  }

  return ApiClient.get<OrdenTrabajo[]>(endpoint);
};

export const getOrden = async (id: number): Promise<OrdenTrabajo> => {
  return ApiClient.get<OrdenTrabajo>(`/api/ordenes/${id}`);
};

export const createOrden = async (body: OrdenRequest): Promise<OrdenTrabajo> => {
  return ApiClient.post<OrdenTrabajo>('/api/ordenes', body);
};

export const updateOrdenEstado = async (
  id: number,
  estado: EstadoOrden,
  descuentoDiagnostico?: boolean,
): Promise<OrdenTrabajo> => {
  const params = new URLSearchParams({ estado });
  if (descuentoDiagnostico != null) {
    params.set('descuentoDiagnostico', String(descuentoDiagnostico));
  }
  return ApiClient.put<OrdenTrabajo>(
    `/api/ordenes/${id}/estado?${params.toString()}`,
    {},
  );
};

export const iniciarReparacion = async (
  ordenId: number,
  body: {
    precio: number;
    repuestoIds: number[];
    descuentoDiagnostico: boolean;
  },
): Promise<OrdenTrabajo> => {
  return ApiClient.post<OrdenTrabajo>(
    `/api/ordenes/${ordenId}/iniciar-reparacion`,
    body,
  );
};

export const addReparacion = async (
  ordenId: number,
  body: ReparacionRequest,
): Promise<Reparacion> => {
  return ApiClient.post<Reparacion>(`/api/ordenes/${ordenId}/reparaciones`, body);
};

export const updateEntrega = async (
  ordenId: number,
  fechaEntrega: string | null,
): Promise<OrdenTrabajo> => {
  return ApiClient.put<OrdenTrabajo>(`/api/ordenes/${ordenId}/entrega`, {
    fechaEntrega,
  });
};

export const asignarTecnico = async (
  ordenId: number,
  tecnicoId: number | null,
): Promise<OrdenTrabajo> => {
  return ApiClient.put<OrdenTrabajo>(`/api/ordenes/${ordenId}/tecnico`, {
    tecnicoId,
  });
};

export const getHistorialOrden = async (
  ordenId: number,
): Promise<HistorialEntry[]> => {
  return ApiClient.get<HistorialEntry[]>(`/api/historial/ORDEN/${ordenId}`);
};

export const getFotosOrden = async (ordenId: number): Promise<FotoOrden[]> => {
  return ApiClient.get<FotoOrden[]>(`/api/ordenes/${ordenId}/fotos`);
};

export const uploadFotoOrden = async (
  ordenId: number,
  file: File,
  etapa: EtapaFoto,
): Promise<FotoOrden> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('etapa', etapa);
  // axios setea el Content-Type multipart con boundary automáticamente.
  return ApiClient.post<FotoOrden>(`/api/ordenes/${ordenId}/fotos`, formData);
};

export const deleteFoto = async (fotoId: number): Promise<unknown> => {
  return ApiClient.delete(`/api/fotos/${fotoId}`);
};

/**
 * Estado público de una reparación. `ref` es el código público del QR;
 * si es numérico, es un ticket impreso antes del código (endpoint legacy,
 * que no devuelve datos del cliente).
 */
export const getPublicRepairStatus = async (
  ref: string,
): Promise<PublicRepairStatus> => {
  if (/^\d+$/.test(ref)) {
    return ApiClient.get<PublicRepairStatus>(`/api/ordenes/${ref}/public`);
  }
  return ApiClient.get<PublicRepairStatus>(
    `/api/ordenes/seguimiento/${encodeURIComponent(ref)}`,
  );
};