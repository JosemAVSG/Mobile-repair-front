import { useMemo, useState, useCallback } from 'react';
import { Input } from '../atoms/Input';
import { Spinner } from '../atoms/Spinner';
import { formatCurrency } from '../../utils/formatters';
import type { Repuesto, RepuestoCantidad } from '../../types';

/** Precio a cobrar por unidad: venta, con fallback al costo. */
export function precioCobradoRepuesto(repuesto: Repuesto): number | null {
  return repuesto.precioVenta ?? repuesto.precioCosto ?? null;
}

/** Selección productoId -> unidades (>= 1). */
export function useSeleccionRepuestos() {
  const [seleccion, setSeleccion] = useState<Record<number, number>>({});

  const toggle = useCallback((id: number) => {
    setSeleccion((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = 1;
      return next;
    });
  }, []);

  const setCantidad = useCallback((id: number, cantidad: number) => {
    setSeleccion((prev) => ({ ...prev, [id]: Math.max(1, Math.floor(cantidad) || 1) }));
  }, []);

  const reset = useCallback(() => setSeleccion({}), []);

  const payload = useMemo<RepuestoCantidad[]>(
    () =>
      Object.entries(seleccion).map(([id, cantidad]) => ({ productoId: Number(id), cantidad })),
    [seleccion],
  );

  return { seleccion, toggle, setCantidad, reset, payload };
}

/** Σ cantidad × (costo | cobrado) de la selección. */
export function totalesSeleccion(repuestos: Repuesto[], seleccion: Record<number, number>) {
  let costo = 0;
  let cobrar = 0;
  for (const r of repuestos) {
    const cantidad = seleccion[r.id];
    if (!cantidad) continue;
    costo += (r.precioCosto ?? 0) * cantidad;
    cobrar += (precioCobradoRepuesto(r) ?? 0) * cantidad;
  }
  return { costo, cobrar };
}

interface RepuestosSelectorProps {
  repuestos: Repuesto[];
  loading?: boolean;
  seleccion: Record<number, number>;
  onToggle: (id: number) => void;
  onCantidadChange: (id: number, cantidad: number) => void;
  idPrefix: string;
  maxHeightClass?: string;
}

export function RepuestosSelector({
  repuestos,
  loading = false,
  seleccion,
  onToggle,
  onCantidadChange,
  idPrefix,
  maxHeightClass = 'max-h-48',
}: RepuestosSelectorProps) {
  const [search, setSearch] = useState('');

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? repuestos.filter((r) => r.nombre.toLowerCase().includes(term)) : repuestos;
  }, [repuestos, search]);

  return (
    <>
      <Input
        type="text"
        placeholder="Buscar repuesto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className={`mt-2 ${maxHeightClass} overflow-y-auto rounded-lg border border-slate-200 p-2`}>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : filtrados.length === 0 ? (
          <p className="py-2 text-center text-sm text-slate-500">
            {search.trim() ? 'No se encontraron repuestos' : 'No hay repuestos disponibles'}
          </p>
        ) : (
          <div className="space-y-1">
            {filtrados.map((repuesto) => {
              const inputId = `${idPrefix}-${repuesto.id}`;
              const cantidad = seleccion[repuesto.id];
              return (
                <div key={repuesto.id} className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-50">
                  <label htmlFor={inputId} className="flex flex-1 cursor-pointer items-center gap-2">
                    <input
                      id={inputId}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={cantidad != null}
                      onChange={() => onToggle(repuesto.id)}
                    />
                    <span className="flex-1 text-sm text-slate-700">{repuesto.nombre}</span>
                    <span className="text-xs text-slate-500">
                      {formatCurrency(precioCobradoRepuesto(repuesto))}
                      {repuesto.stock != null && ` · Stock: ${repuesto.stock}`}
                    </span>
                  </label>
                  {cantidad != null && (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      aria-label={`Cantidad de ${repuesto.nombre}`}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      value={cantidad}
                      onChange={(e) => onCantidadChange(repuesto.id, Number(e.target.value))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
