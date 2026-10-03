import { ApiClient } from './ApiClient';
import type { AuthUser, LoginResponse } from '../types';

export const login = async (
  username: string,
  password: string,
): Promise<LoginResponse> => {
  return ApiClient.post<LoginResponse>('/api/auth/login', { username, password });
};

export const getMe = async (): Promise<AuthUser> => {
  return ApiClient.get<AuthUser>('/api/auth/me');
};