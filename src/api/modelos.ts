import { ApiClient } from './ApiClient';
import type { Modelo, ModeloRequest } from '../types';

export const getModelos = async (): Promise<Modelo[]> => {
  return ApiClient.get<Modelo[]>('/api/modelos');
};

export const getModelo = async (id: number): Promise<Modelo> => {
  return ApiClient.get<Modelo>(`/api/modelos/${id}`);
};

export const createModelo = async (body: ModeloRequest): Promise<Modelo> => {
  return ApiClient.post<Modelo>('/api/modelos', body);
};

export const deleteModelo = async (id: number): Promise<unknown> => {
  return ApiClient.delete(`/api/modelos/${id}`);
};