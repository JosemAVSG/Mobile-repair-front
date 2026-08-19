// ──────────────────────────────────────────────
// Labels (tipos y categorías)
// ──────────────────────────────────────────────

import { TipoDispositivo, CategoriaMarca } from '../types';

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

export function tipoDispositivoLabel(tipo: TipoDispositivo): string {
  return TIPO_DISPOSITIVO_LABELS[tipo];
}

export function categoriaMarcaLabel(cat: CategoriaMarca): string {
  return CATEGORIA_MARCA_LABELS[cat];
}

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
