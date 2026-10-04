import type { PlanCatalogo } from '../types';

const KEY = 'fixtra:plan-interes';

type PlanId = PlanCatalogo['plan'];

/** Acepta "pro", "PRO", "basico"… y descarta cualquier otro valor. */
export function parsePlan(value: string | null | undefined): PlanId | null {
  const v = value?.trim().toUpperCase();
  return v === 'BASICO' || v === 'PRO' ? v : null;
}

/** Guarda el plan que el usuario eligió en la landing (?plan=…) para sugerirlo después del registro. */
export function savePlanIntentFromSearch(search: string): void {
  const plan = parsePlan(new URLSearchParams(search).get('plan'));
  if (!plan) return;
  try {
    localStorage.setItem(KEY, plan);
  } catch {
    // almacenamiento no disponible: la sugerencia es opcional
  }
}

export function getPlanIntent(): PlanId | null {
  try {
    return parsePlan(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearPlanIntent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
