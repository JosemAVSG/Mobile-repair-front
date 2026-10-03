import { ApiClient } from './ApiClient';
import type { Marca, MarcaRequest } from '../types';

export const getMarcas = async (): Promise<Marca[]> => {
  return ApiClient.get<Marca[]>('/api/marcas');
};

export const createMarca = async (body: MarcaRequest): Promise<Marca> => {
  return ApiClient.post<Marca>('/api/marcas', body);
};

export const deleteMarca = async (id: number): Promise<unknown> => {
  return ApiClient.delete(`/api/marcas/${id}`);
};