import { ApiClient } from './ApiClient';
import type { Tecnico, TecnicoRequest } from '../types';

export const getTecnicos = async (): Promise<Tecnico[]> => {
  return ApiClient.get<Tecnico[]>('/api/tecnicos');
};

export const createTecnico = async (body: TecnicoRequest): Promise<Tecnico> => {
  return ApiClient.post<Tecnico>('/api/tecnicos', body);
};

export const updateTecnico = async (
  id: number,
  body: TecnicoRequest,
): Promise<Tecnico> => {
  return ApiClient.put<Tecnico>(`/api/tecnicos/${id}`, body);
};

export const deleteTecnico = async (id: number): Promise<unknown> => {
  return ApiClient.delete(`/api/tecnicos/${id}`);
};