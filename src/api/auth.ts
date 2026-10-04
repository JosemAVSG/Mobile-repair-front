import { ApiClient } from './ApiClient';
import type { AuthUser, LoginResponse, RegisterTallerRequest } from '../types';

export const login = async (
  username: string,
  password: string,
): Promise<LoginResponse> => {
  return ApiClient.post<LoginResponse>('/api/auth/login', { username, password });
};

export const getMe = async (): Promise<AuthUser> => {
  return ApiClient.get<AuthUser>('/api/auth/me');
};

/** Alta autoservicio de un taller (público). Responde 201 con JWT. */
export const registerTaller = async (
  req: RegisterTallerRequest,
): Promise<LoginResponse> => {
  return ApiClient.post<LoginResponse>('/api/auth/register-taller', req);
};
