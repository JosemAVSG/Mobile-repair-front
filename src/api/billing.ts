import { ApiClient as api } from './ApiClient';
import type { Cobro, MetodoPagoRequest, PlanSuscripcion, Suscripcion, WompiAcceptance } from '../types';

export async function getSuscripcion(): Promise<Suscripcion> {
  return api.get<Suscripcion>('/api/billing/suscripcion');
}

export async function getWompiAcceptance(): Promise<WompiAcceptance> {
  return api.get<WompiAcceptance>('/api/billing/wompi/acceptance');
}

export async function registrarMetodoPago(req: MetodoPagoRequest): Promise<Suscripcion> {
  return api.post<Suscripcion>('/api/billing/metodo-pago', req);
}

export async function cambiarPlan(plan: PlanSuscripcion): Promise<Suscripcion> {
  return api.post<Suscripcion>('/api/billing/plan', { plan });
}

export async function cancelarSuscripcion(): Promise<Suscripcion> {
  return api.post<Suscripcion>('/api/billing/cancelar');
}

export async function reactivarSuscripcion(): Promise<Suscripcion> {
  return api.post<Suscripcion>('/api/billing/reactivar');
}

export async function getCobros(limit = 12): Promise<Cobro[]> {
  return api.get<Cobro[]>('/api/billing/cobros', { params: { limit } });
}
