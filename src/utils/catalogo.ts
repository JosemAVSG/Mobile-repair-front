import { ApiError } from '../api/ApiClient';

/** Mensaje al crear marca/modelo (409 = duplicado visible, global o propio). */
export function catalogoCreateError(err: unknown, entidad: 'marca' | 'modelo'): string {
  if (err instanceof ApiError && err.status === 409) {
    return `Ya existe ${entidad === 'marca' ? 'una marca' : 'un modelo'} con ese nombre (propio o del catálogo global).`;
  }
  if (err instanceof ApiError && err.status === 403) {
    return 'No tienes permiso para realizar esta acción.';
  }
  return err instanceof Error && err.message
    ? err.message
    : `Error al crear ${entidad}`;
}

/** Mensaje al eliminar marca/modelo (403 = registro global, solo lectura). */
export function catalogoDeleteError(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) {
    return 'Los registros globales del catálogo son de solo lectura y no se pueden eliminar.';
  }
  if (err instanceof ApiError && err.status === 409) {
    return 'No se puede eliminar: el registro está en uso.';
  }
  return err instanceof Error && err.message ? err.message : 'Error al eliminar';
}
