import { useMemo } from 'react';
import type { Marca, Modelo } from '../../types';

interface ModelosCompatiblesSelectProps {
  modelos: Modelo[];
  marcas: Marca[];
  /** Ids de modelos seleccionados. */
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}

/**
 * Multi-select de modelos compatibles: un select agrupado por marca para agregar y chips
 * removibles para los modelos elegidos.
 */
export function ModelosCompatiblesSelect({
  modelos,
  marcas,
  value,
  onChange,
  disabled = false,
}: ModelosCompatiblesSelectProps) {
  const marcaNombre = useMemo(() => new Map(marcas.map((m) => [m.id, m.nombre])), [marcas]);
  const modeloMap = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos]);

  const labelOf = (id: number): string => {
    const modelo = modeloMap.get(id);
    if (!modelo) return `Modelo #${id}`;
    const marca = marcaNombre.get(modelo.marcaId);
    return marca ? `${marca} ${modelo.nombre}` : modelo.nombre;
  };

  const groups = useMemo(() => {
    const selected = new Set(value);
    return marcas
      .map((marca) => ({
        marca,
        modelos: modelos.filter((m) => m.marcaId === marca.id && !selected.has(m.id)),
      }))
      .filter((g) => g.modelos.length > 0);
  }, [marcas, modelos, value]);

  return (
    <div className="flex flex-col gap-2">
      <select
        aria-label="Agregar modelo compatible"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
        value=""
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === '') return;
          onChange([...value, Number(e.target.value)]);
        }}
      >
        <option value="">Agregar modelo compatible...</option>
        {groups.map((g) => (
          <optgroup key={g.marca.id} label={g.marca.nombre}>
            {g.modelos.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.nombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {value.length === 0 ? (
        <p className="text-xs text-slate-500">Sin modelos seleccionados</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {value.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
            >
              <span>{labelOf(id)}</span>
              <button
                type="button"
                aria-label={`Quitar ${labelOf(id)}`}
                disabled={disabled}
                className="rounded-full px-1 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                onClick={() => onChange(value.filter((v) => v !== id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
