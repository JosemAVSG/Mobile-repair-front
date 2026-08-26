import { EstadoOrden, type EtapaFoto } from '../types';

// ──────────────────────────────────────────────
// Agrupaciones de estados (fuente única)
// ──────────────────────────────────────────────

const ALL_STATES = Object.values(EstadoOrden);

/** Estados que cierran el ciclo de la orden en el taller. */
export const TERMINAL_STATES: ReadonlySet<EstadoOrden> = new Set([
  EstadoOrden.ENTREGADO,
  EstadoOrden.DEVUELTO,
]);

/** Órdenes aún activas en el taller (no terminales). */
export const ACTIVE_STATES: ReadonlySet<EstadoOrden> = new Set(
  ALL_STATES.filter((estado) => !TERMINAL_STATES.has(estado)),
);

/** Estados dentro del proceso técnico de reparación. */
export const REPAIR_STATES: ReadonlySet<EstadoOrden> = new Set([
  EstadoOrden.REPARACION,
  EstadoOrden.ESPERANDO_REPUESTO,
  EstadoOrden.REPARACION_COMPLETADA,
  EstadoOrden.CONTROL_CALIDAD,
]);

/** Estados que habilitan el conteo de ingresos (pago recibido o cobrado). */
export const REVENUE_STATES: ReadonlySet<EstadoOrden> = new Set([
  EstadoOrden.PAGADO,
  EstadoOrden.ENTREGADO,
  EstadoOrden.GARANTIA,
]);

// ──────────────────────────────────────────────
// Fotos por etapa del ciclo de vida
// ──────────────────────────────────────────────

/**
 * Estados en los que tiene sentido capturar cada etapa fotográfica.
 * Fuera de estos estados la subida/eliminación queda bloqueada en la UI.
 */
export const FOTO_ETAPA_STATES: Record<
  EtapaFoto,
  ReadonlySet<EstadoOrden>
> = {
  ANTES: new Set([
    EstadoOrden.REGISTRO,
    EstadoOrden.DIAGNOSTICO,
    EstadoOrden.PRESUPUESTO_RECHAZADO,
  ]),
  DURANTE: new Set([
    EstadoOrden.REPARACION,
    EstadoOrden.ESPERANDO_REPUESTO,
    EstadoOrden.CONTROL_CALIDAD,
  ]),
  DESPUES: new Set([
    EstadoOrden.REPARACION_COMPLETADA,
    EstadoOrden.CONTROL_CALIDAD,
    EstadoOrden.ESPERANDO_ENTREGA,
    EstadoOrden.PAGADO,
    EstadoOrden.ENTREGADO,
    EstadoOrden.GARANTIA,
  ]),
};

export function puedeSubirFotoEtapa(
  etapa: EtapaFoto,
  estado: EstadoOrden,
): boolean {
  return FOTO_ETAPA_STATES[etapa].has(estado);
}

// Guardia de exhaustividad: al agregar un valor al enum,
// este registro fuerza a revisar las agrupaciones de arriba.
const _exhaustiveCheck: Record<EstadoOrden, true> = {
  [EstadoOrden.REGISTRO]: true,
  [EstadoOrden.DIAGNOSTICO]: true,
  [EstadoOrden.REPARACION]: true,
  [EstadoOrden.ESPERANDO_REPUESTO]: true,
  [EstadoOrden.REPARACION_COMPLETADA]: true,
  [EstadoOrden.CONTROL_CALIDAD]: true,
  [EstadoOrden.ESPERANDO_ENTREGA]: true,
  [EstadoOrden.PAGADO]: true,
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: true,
  [EstadoOrden.DEVUELTO]: true,
  [EstadoOrden.ENTREGADO]: true,
  [EstadoOrden.GARANTIA]: true,
};
void _exhaustiveCheck;
