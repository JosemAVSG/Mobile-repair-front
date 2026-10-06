import { EstadoOrden } from '../types';
import type {
  AuthUser,
  OrdenTrabajo,
  Reparacion,
  Repuesto,
  RepuestoSnapshot,
  Tecnico,
} from '../types';
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

export const REVISION_INICIAL = 'Revisión inicial';

/** Estados en los que el backend rechaza (409) modificar repuestos. */
export function repuestosBloqueados(estado: EstadoOrden | undefined): boolean {
  return estado === EstadoOrden.PAGADO || estado === EstadoOrden.ENTREGADO;
}

/** Id de catálogo (`productos.id`) de un snapshot. `repuestoId` es OTRA tabla
 *  (legado): jamás se usa como id de producto. Null = snapshot legado. */
export function snapshotRepuestoId(snapshot: RepuestoSnapshot): number | null {
  return snapshot.productoId ?? null;
}

/**
 * Ids de producto (sin duplicados, en orden) ya adjuntos a las reparaciones de
 * la orden que existen en el listado de repuestos. Los snapshots legados (sin
 * productoId) se ignoran.
 */
export function repuestoIdsAdjuntos(
  reparaciones: Pick<Reparacion, 'repuestos'>[] | undefined,
  repuestos: Pick<Repuesto, 'id'>[],
): number[] {
  const validos = new Set(repuestos.map((r) => r.id));
  const ids = new Set<number>();
  for (const reparacion of reparaciones ?? []) {
    for (const snapshot of reparacion.repuestos ?? []) {
      const id = snapshotRepuestoId(snapshot);
      if (id != null && validos.has(id)) ids.add(id);
    }
  }
  return Array.from(ids);
}

/**
 * Ids de producto que la orden ya cobra. Con `descuentoDiagnostico` los
 * repuestos de la "Revisión inicial" no se cobran, así que no cuentan.
 */
export function repuestoIdsCobrados(
  reparaciones: Pick<Reparacion, 'descripcion' | 'repuestos'>[] | undefined,
  descuentoDiagnostico: boolean | undefined,
): Set<number> {
  const ids = new Set<number>();
  for (const reparacion of reparaciones ?? []) {
    if (descuentoDiagnostico && reparacion.descripcion === REVISION_INICIAL) continue;
    for (const snapshot of reparacion.repuestos ?? []) {
      const id = snapshotRepuestoId(snapshot);
      if (id != null) ids.add(id);
    }
  }
  return ids;
}

/** Reparación sobre la que se editan los repuestos de una orden existente:
 *  la más reciente que no es la "Revisión inicial". */
export function reparacionEditable(
  reparaciones: Reparacion[] | undefined,
): Reparacion | null {
  const candidatas = (reparaciones ?? []).filter(
    (r) => r.descripcion !== REVISION_INICIAL,
  );
  return candidatas.length > 0 ? candidatas[candidatas.length - 1] : null;
}

/** Conjunto final (PUT) de productoIds de una reparación tras agregar/quitar uno.
 *  Los snapshots legados (sin productoId) nunca se envían: el backend los deja intactos. */
export function idsTrasCambio(
  reparacion: Pick<Reparacion, 'repuestos'>,
  cambio: { agregar?: number; quitar?: number },
): number[] {
  const ids = new Set<number>();
  for (const snapshot of reparacion.repuestos ?? []) {
    const id = snapshotRepuestoId(snapshot);
    if (id != null) ids.add(id);
  }
  if (cambio.quitar != null) ids.delete(cambio.quitar);
  if (cambio.agregar != null) ids.add(cambio.agregar);
  return Array.from(ids);
}

export interface TecnicoResponsable {
  id: number;
  nombre: string;
  correo?: string | null;
}

/**
 * Técnico responsable de la orden. `GET /api/tecnicos` es ADMIN-only, así que un
 * TECNICO recibe la lista vacía: si la orden es suya se resuelve desde la sesión,
 * y si hay `tecnicoId` pero no se puede resolver el nombre se devuelve un
 * marcador (nunca `null`, para no mostrar "Sin técnico asignado").
 */
export function resolverTecnicoResponsable(
  tecnicoId: number | null | undefined,
  tecnicos: Pick<Tecnico, 'id' | 'nombre' | 'correo'>[] | undefined,
  user: Pick<AuthUser, 'id' | 'nombre' | 'correo' | 'tecnicoId'> | null | undefined,
  tecnicoNombre?: string | null,
): TecnicoResponsable | null {
  if (tecnicoId == null) return null;
  const enLista = tecnicos?.find((t) => t.id === tecnicoId);
  const esMio = user != null && (user.tecnicoId ?? user.id) === tecnicoId;
  // El backend ya devuelve el nombre en la orden: tiene prioridad sobre lista/sesión.
  const nombreOrden = tecnicoNombre?.trim();
  if (nombreOrden) {
    return {
      id: tecnicoId,
      nombre: nombreOrden,
      correo: enLista?.correo ?? (esMio ? user.correo : null),
    };
  }
  if (enLista) return enLista;
  if (esMio) {
    return { id: tecnicoId, nombre: user.nombre, correo: user.correo };
  }
  return { id: tecnicoId, nombre: 'Técnico asignado', correo: null };
}
