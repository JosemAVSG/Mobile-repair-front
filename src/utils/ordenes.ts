import type { OrdenTrabajo } from '../types';
import { TERMINAL_STATES } from './estados';

/**
 * True si la orden tiene una cita de entrega que ya venció y aún sigue
 * activa en el taller (estado no terminal).
 */
export function isOrdenAtrasada(
  orden: Pick<OrdenTrabajo, 'fechaEntrega' | 'estado'>,
): boolean {
  if (!orden.fechaEntrega) return false;
  if (TERMINAL_STATES.has(orden.estado)) return false;
  return new Date(orden.fechaEntrega).getTime() < Date.now();
}
