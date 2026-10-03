import { ApiClient } from './ApiClient';
import type { Repuesto, RepuestoRequest } from '../types';

export const getRepuestos = async (nombre?: string): Promise<Repuesto[]> => {
  const endpoint = nombre
    ? `/api/repuestos?nombre=${encodeURIComponent(nombre)}`
    : '/api/repuestos';
  return ApiClient.get<Repuesto[]>(endpoint);
};

export const createRepuesto = async (body: RepuestoRequest): Promise<Repuesto> => {
  return ApiClient.post<Repuesto>('/api/repuestos', body);
};

export const updateRepuesto = async (
  id: number,
  body: RepuestoRequest,
): Promise<Repuesto> => {
  return ApiClient.put<Repuesto>(`/api/repuestos/${id}`, body);
};

export const deleteRepuesto = async (id: number): Promise<unknown> => {
  return ApiClient.delete(`/api/repuestos/${id}`);
};