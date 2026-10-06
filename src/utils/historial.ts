import { estadoConfig } from '../components/molecules/StatusBadge';
import type { TimelineEvent } from '../components/molecules/OrderTimeline';

const CODIGOS_ESTADO = new RegExp(`\\b(${Object.keys(estadoConfig).join('|')})\\b`, 'g');

/** Reemplaza códigos EstadoOrden crudos por su etiqueta; el resto del texto queda intacto. */
export function humanizarHistorial(contenido: string): string {
  return contenido.replace(CODIGOS_ESTADO, (codigo) => {
    const cfg = estadoConfig[codigo as keyof typeof estadoConfig];
    return cfg ? cfg.label : codigo;
  });
}

/** Tipo visual de la entrada según su texto (sin parsear importes). */
export function tipoEventoHistorial(contenido: string): TimelineEvent['type'] {
  if (contenido.startsWith('Repuesto agregado')) return 'repuesto-add';
  if (contenido.startsWith('Repuesto quitado')) return 'repuesto-remove';
  if (contenido.includes('creada')) return 'created';
  if (contenido.includes('estado') || contenido.includes('Estado')) return 'status';
  return 'note';
}
