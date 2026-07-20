import { EstadoOrden } from '../../types';
import { Badge } from '../atoms/Badge';

const estadoConfig: Record<
  EstadoOrden,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }
> = {
  [EstadoOrden.REGISTRO]: {
    label: 'Registrado',
    variant: 'default',
  },
  [EstadoOrden.DIAGNOSTICO]: {
    label: 'En Diagnóstico',
    variant: 'info',
  },
  [EstadoOrden.REPARACION]: {
    label: 'En Reparación',
    variant: 'warning',
  },
  [EstadoOrden.ESPERANDO_REPUESTO]: {
    label: 'Esperando Repuesto',
    variant: 'warning',
  },
  [EstadoOrden.ESPERANDO_ENTREGA]: {
    label: 'Esperando Entrega',
    variant: 'info',
  },
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: {
    label: 'Presupuesto Rechazado',
    variant: 'danger',
  },
  [EstadoOrden.ENTREGADO]: {
    label: 'Entregado',
    variant: 'success',
  },
};

interface StatusBadgeProps {
  estado: EstadoOrden;
}

export function StatusBadge({ estado }: StatusBadgeProps) {
  const config = estadoConfig[estado];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
