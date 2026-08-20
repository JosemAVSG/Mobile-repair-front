import { EstadoOrden, type OrdenTrabajo } from '../types';

/**
 * True si la orden tiene una cita de entrega que ya venció y aún no fue
 * entregada (estado distinto de ENTREGADO).
 */
export function isOrdenAtrasada(
  orden: Pick<OrdenTrabajo, 'fechaEntrega' | 'estado'>,
): boolean {
  if (!orden.fechaEntrega) return false;
  if (orden.estado === EstadoOrden.ENTREGADO) return false;
  return new Date(orden.fechaEntrega).getTime() < Date.now();
}