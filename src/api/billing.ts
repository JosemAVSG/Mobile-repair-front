import { ApiClient as api } from './ApiClient';
import type { Suscripcion } from '../types';

export interface CheckoutRequest {
  plan?: 'BASICO' | 'PRO';
}

export interface CheckoutResponse {
  url: string;
}

export interface PortalResponse {
  url: string;
}

export async function createCheckout(plan?: 'BASICO' | 'PRO'): Promise<string> {
  const res = await api.post<CheckoutResponse>('/api/billing/checkout', plan ? { plan } : undefined);
  return res.url;
}

export async function getSuscripcion(): Promise<Suscripcion> {
  return api.get<Suscripcion>('/api/billing/suscripcion');
}

export async function getPortalLink(): Promise<string> {
  const res = await api.post<PortalResponse>('/api/billing/portal');
  return res.url;
}
