/**
 * Base de las URLs que se imprimen en el QR del ticket.
 * Se configura con VITE_PUBLIC_URL para que los tickets no queden atados al
 * dominio desde donde se abrió la app (si el dominio cambia, los QR ya impresos
 * dejarían de funcionar). Sin variable, usa el origen actual.
 */
export const getPublicBaseUrl = (): string =>
  (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, '');

/** URL pública de seguimiento. Usa el código no adivinable; el id solo como respaldo. */
export const getSeguimientoUrl = (orden: { id: number; codigoPublico?: string | null }): string =>
  `${getPublicBaseUrl()}/estado/${orden.codigoPublico ?? orden.id}`;
