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

/**
 * Número de orden a mostrar (sin `#`). Usa el número por taller que entrega el
 * backend; si falta (datos viejos/respuestas antiguas) cae al id con el mismo
 * formato de 4 dígitos.
 */
export function formatNumeroOrden(
  orden: Pick<OrdenTrabajo, 'id' | 'numeroOrden'>,
): string {
  const numero = orden.numeroOrden?.trim();
  return numero ? numero : String(orden.id).padStart(4, '0');
}
