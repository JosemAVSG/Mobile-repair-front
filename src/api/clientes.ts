import { ApiClient } from './ApiClient';
import type { Cliente, ClienteRequest } from '../types';

export const getClientes = async (): Promise<Cliente[]> => {
  return ApiClient.get<Cliente[]>('/api/clientes');
};

export const getCliente = async (id: number): Promise<Cliente> => {
  return ApiClient.get<Cliente>(`/api/clientes/${id}`);
};

export const createCliente = async (body: ClienteRequest): Promise<Cliente> => {
  return ApiClient.post<Cliente>('/api/clientes', body);
};

export const updateCliente = async (
  id: number,
  body: ClienteRequest,
): Promise<Cliente> => {
  return ApiClient.put<Cliente>(`/api/clientes/${id}`, body);
};

export const deleteCliente = async (id: number): Promise<unknown> => {
  return ApiClient.delete(`/api/clientes/${id}`);
};