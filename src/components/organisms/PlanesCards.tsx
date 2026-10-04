import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { formatCop } from '../../utils/formatters';
import type { PlanCatalogo, PlanSuscripcion } from '../../types';

interface PlanesCardsProps {
  planes: PlanCatalogo[];
  /** Plan contratado hoy (solo cuenta si la suscripción está activa). */
  currentPlan?: PlanSuscripcion | null;
  /** Plan que se aplicará en el próximo cobro, si ya hay un cambio agendado. */
  pendingPlan?: PlanSuscripcion | null;
  /** Texto del botón de los planes elegibles. */
  actionLabel: string;
  disabled?: boolean;
  onSelect: (plan: PlanCatalogo['plan']) => void;
}

export function PlanesCards({ planes, currentPlan, pendingPlan, actionLabel, disabled, onSelect }: PlanesCardsProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Planes disponibles">
      {planes.map((p) => {
        const isCurrent = p.plan === currentPlan;
        const isPending = p.plan === pendingPlan;
        return (
          <li
            key={p.plan}
            className={`flex flex-col rounded-lg border bg-white p-4 ${
              p.destacado ? 'border-blue-500' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-base font-semibold text-slate-800">{p.nombre}</h5>
              {isCurrent ? (
                <Badge variant="success">Plan actual</Badge>
              ) : isPending ? (
                <Badge variant="info">Próximo plan</Badge>
              ) : p.destacado ? (
                <Badge variant="info">Más elegido</Badge>
              ) : null}
            </div>
            {p.descripcion && <p className="mt-1 text-sm text-slate-600">{p.descripcion}</p>}
            <p className="mt-3 text-2xl font-bold text-slate-800">
              {formatCop(p.precioCop)}
              <span className="ml-1 text-sm font-normal text-slate-500">/ mes</span>
            </p>
            <ul className="mt-3 flex-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Button
              type="button"
              className="mt-4"
              variant={p.destacado ? 'primary' : 'secondary'}
              disabled={disabled || isCurrent || isPending}
              onClick={() => onSelect(p.plan)}
            >
              {isCurrent ? 'Plan actual' : isPending ? 'Agendado' : `${actionLabel} ${p.nombre}`}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
