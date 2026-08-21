// ──────────────────────────────────────────────
// Labels (tipos y categorías)
// ──────────────────────────────────────────────

import {
  TipoDispositivo,
  TipoReparacion,
  CategoriaMarca,
  type RolUsuario,
  type EstadoStock,
  type TipoMovimiento,
} from '../types';

export const ROL_LABELS: Record<RolUsuario, string> = {
  ADMIN: 'Administrador',
  TECNICO: 'Técnico',
};

export const ROL_BADGE: Record<RolUsuario, 'info' | 'warning'> = {
  ADMIN: 'info',
  TECNICO: 'warning',
};

export const TIPO_DISPOSITIVO_LABELS: Record<TipoDispositivo, string> = {
  [TipoDispositivo.CELULAR]: 'Celular',
  [TipoDispositivo.MICROONDAS]: 'Microondas',
  [TipoDispositivo.NEVERA]: 'Nevera',
  [TipoDispositivo.COCINA]: 'Cocina',
  [TipoDispositivo.LAVADORA]: 'Lavadora',
  [TipoDispositivo.COMPUTADORA]: 'Computadora',
};

export const CATEGORIA_MARCA_LABELS: Record<CategoriaMarca, string> = {
  [CategoriaMarca.CELULARES]: 'Celulares',
  [CategoriaMarca.LINEA_BLANCA]: 'Línea Blanca',
  [CategoriaMarca.COMPUTADORAS]: 'Computadoras',
};

export const TIPO_REPARACION_LABELS: Record<TipoReparacion, string> = {
  [TipoReparacion.PANTALLA]: 'Pantalla',
  [TipoReparacion.BATERIA]: 'Batería',
  [TipoReparacion.ALTAVOZ]: 'Altavoz',
  [TipoReparacion.MICROFONO]: 'Micrófono',
  [TipoReparacion.CARGADOR]: 'Cargador',
  [TipoReparacion.BOTONES]: 'Botones',
  [TipoReparacion.CÁMARA]: 'Cámara',
  [TipoReparacion.PLACA]: 'Placa',
  [TipoReparacion.SOFTWARE]: 'Software',
  [TipoReparacion.OTRO]: 'Otro',
};

export function tipoReparacionLabel(tipo: TipoReparacion): string {
  return TIPO_REPARACION_LABELS[tipo];
}

export function tipoDispositivoLabel(tipo: TipoDispositivo): string {
  return TIPO_DISPOSITIVO_LABELS[tipo];
}

export function categoriaMarcaLabel(cat: CategoriaMarca): string {
  return CATEGORIA_MARCA_LABELS[cat];
}

export interface BadgeConfig {
  label: string;
  variant: 'info' | 'warning' | 'default';
}

export function tipoBadgeConfig(tipo: TipoDispositivo): BadgeConfig {
  const variant: BadgeConfig['variant'] =
    tipo === TipoDispositivo.CELULAR || tipo === TipoDispositivo.LAVADORA
      ? 'info'
      : tipo === TipoDispositivo.MICROONDAS || tipo === TipoDispositivo.COCINA
        ? 'warning'
        : 'default';
  return { label: TIPO_DISPOSITIVO_LABELS[tipo], variant };
}

export function categoriaBadgeConfig(cat: CategoriaMarca): BadgeConfig {
  const variant: BadgeConfig['variant'] =
    cat === CategoriaMarca.CELULARES
      ? 'info'
      : cat === CategoriaMarca.LINEA_BLANCA
        ? 'warning'
        : 'default';
  return { label: CATEGORIA_MARCA_LABELS[cat], variant };
}

export function rolBadgeConfig(rol: RolUsuario): BadgeConfig {
  const variant: BadgeConfig['variant'] =
    rol === 'ADMIN' ? 'info' : 'warning';
  return { label: ROL_LABELS[rol], variant };
}

export const ESTADO_STOCK_LABELS: Record<EstadoStock, string> = {
  OK: 'OK',
  BAJO: 'Bajo stock',
  SIN_STOCK: 'Sin stock',
};

export const ESTADO_STOCK_VARIANTS: Record<EstadoStock, 'success' | 'warning' | 'danger'> = {
  OK: 'success',
  BAJO: 'warning',
  SIN_STOCK: 'danger',
};

export const TIPO_MOVIMIENTO_LABELS: Record<TipoMovimiento, string> = {
  COMPRA: 'Compra',
  CONSUMO: 'Consumo',
};

// ──────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────

/**
 * Format a number as currency in CLP (Chilean Peso).
 * Example: 1234.56 → "$1.234,56"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format an ISO date string to Spanish short date.
 * Example: "2026-07-20T14:30:00Z" → "20/07/2026"
 */
export function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return '—';
  }
}

/**
 * Format an ISO date string to Spanish short date + time.
 * Example: "2026-07-20T14:30:00Z" → "20/07/2026 14:30"
 */
export function formatDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}
