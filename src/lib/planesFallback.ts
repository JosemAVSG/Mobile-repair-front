import type { PlanCatalogo } from '../types';

/**
 * Respaldo si GET /api/billing/planes falla. La fuente de verdad es el backend;
 * estos valores solo evitan una pantalla vacía y deben coincidir con los precios vigentes.
 */
export const PLANES_FALLBACK: PlanCatalogo[] = [
  {
    plan: 'BASICO',
    nombre: 'Básico',
    descripcion: 'Para el taller que arranca a ordenarse.',
    precioCop: 49900,
    features: [
      'Hasta 3 técnicos (incluido el administrador)',
      'Inventario, costo y ganancia por orden',
    ],
    destacado: false,
  },
  {
    plan: 'PRO',
    nombre: 'Pro',
    descripcion: 'Para el taller con equipo y stock propio.',
    precioCop: 99900,
    features: [
      'Hasta 8 técnicos (incluido el administrador)',
      'Inventario, costo y ganancia por orden',
      'Métricas avanzadas',
    ],
    destacado: true,
  },
];
