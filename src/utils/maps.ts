// ──────────────────────────────────────────────
// Maps & options (entidades → label/id)
// ──────────────────────────────────────────────

import type { Cliente, Marca, Modelo } from '../types';

export function buildMarcaMap(marcas: Marca[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const m of marcas) {
    map.set(m.id, m.nombre);
  }
  return map;
}

export function buildMarcaObjMap(marcas: Marca[]): Map<number, Marca> {
  const map = new Map<number, Marca>();
  for (const m of marcas) {
    map.set(m.id, m);
  }
  return map;
}

export function buildModeloMap(modelos: Modelo[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const m of modelos) {
    map.set(m.id, m.nombre);
  }
  return map;
}

export function buildClienteMap(clientes: Cliente[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const c of clientes) {
    map.set(c.id, c.nombre);
  }
  return map;
}

export function buildMarcaOptions(marcas: Marca[]): { value: string; label: string }[] {
  return marcas.map((m) => ({ value: String(m.id), label: m.nombre }));
}

export function buildModeloOptions(modelos: Modelo[]): { value: string; label: string }[] {
  return modelos.map((m) => ({ value: String(m.id), label: m.nombre }));
}

export function buildClienteOptions(clientes: Cliente[]): { value: string; label: string }[] {
  return clientes.map((c) => ({ value: String(c.id), label: c.nombre }));
}
