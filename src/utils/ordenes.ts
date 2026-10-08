import { EstadoOrden } from '../types';
import type {
  AuthUser,
  OrdenTrabajo,
  Reparacion,
  RepuestoCantidad,
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

/** Mapa productoId -> unidades de los snapshots de UNA reparación. Ausente `cantidad` = 1;
 *  los snapshots legados (sin productoId) se ignoran: el backend los deja intactos. */
export function cantidadesDeReparacion(
  reparacion: Pick<Reparacion, 'repuestos'>,
): Map<number, number> {
  const mapa = new Map<number, number>();
  for (const snapshot of reparacion.repuestos ?? []) {
    const id = snapshotRepuestoId(snapshot);
    if (id == null) continue;
    mapa.set(id, (mapa.get(id) ?? 0) + (snapshot.cantidad ?? 1));
  }
  return mapa;
}

/** Línea de repuestos lista para el body: orden estable, cantidades >= 1. */
export function repuestosPayload(cantidades: Map<number, number>): RepuestoCantidad[] {
  return Array.from(cantidades.entries())
    .filter(([, cantidad]) => cantidad >= 1)
    .map(([productoId, cantidad]) => ({ productoId, cantidad }));
}

/** Mapa final (PUT, reemplazo completo) de una reparación tras un cambio:
 *  `agregar` SUMA unidades, `fijar` pone la cantidad exacta, `quitar` elimina el producto. */
export function cantidadesTrasCambio(
  reparacion: Pick<Reparacion, 'repuestos'>,
  cambio: {
    agregar?: RepuestoCantidad;
    fijar?: RepuestoCantidad;
    quitar?: number;
  },
): Map<number, number> {
  const mapa = cantidadesDeReparacion(reparacion);
  if (cambio.quitar != null) mapa.delete(cambio.quitar);
  if (cambio.fijar) mapa.set(cambio.fijar.productoId, Math.max(1, cambio.fijar.cantidad));
  if (cambio.agregar) {
    mapa.set(
      cambio.agregar.productoId,
      (mapa.get(cambio.agregar.productoId) ?? 0) + Math.max(1, cambio.agregar.cantidad),
    );
  }
  return mapa;
}

/** Unidades de un snapshot (ausente = 1). */
export function cantidadSnapshot(snapshot: Pick<RepuestoSnapshot, 'cantidad'>): number {
  return snapshot.cantidad ?? 1;
}

/** Precio unitario cobrado de un snapshot (venta, con fallback al costo). */
export function precioUnitarioSnapshot(snapshot: RepuestoSnapshot): number | null {
  return snapshot.precioCobrado ?? snapshot.precioVenta ?? snapshot.precioCosto ?? null;
}

/** Total de la línea: `totalCobrado` del backend o, si falta, unitario × cantidad. */
export function totalCobradoSnapshot(snapshot: RepuestoSnapshot): number | null {
  if (snapshot.totalCobrado != null) return snapshot.totalCobrado;
  const unit = precioUnitarioSnapshot(snapshot);
  return unit == null ? null : unit * cantidadSnapshot(snapshot);
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
