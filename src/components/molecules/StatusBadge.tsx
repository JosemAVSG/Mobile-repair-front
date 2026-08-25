import { EstadoOrden } from '../../types';
import { Badge } from '../atoms/Badge';

export type EstadoBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

export const estadoConfig: Record<
  EstadoOrden,
  { label: string; variant: EstadoBadgeVariant }
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
  [EstadoOrden.REPARACION_COMPLETADA]: {
    label: 'Reparación Completada',
    variant: 'info',
  },
  [EstadoOrden.CONTROL_CALIDAD]: {
    label: 'Control de Calidad',
    variant: 'info',
  },
  [EstadoOrden.ESPERANDO_ENTREGA]: {
    label: 'Lista para Retiro',
    variant: 'info',
  },
  [EstadoOrden.PAGADO]: {
    label: 'Pagado',
    variant: 'success',
  },
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: {
    label: 'Presupuesto Rechazado',
    variant: 'danger',
  },
  [EstadoOrden.DEVUELTO]: {
    label: 'Devuelto',
    variant: 'danger',
  },
  [EstadoOrden.ENTREGADO]: {
    label: 'Entregado',
    variant: 'success',
  },
  [EstadoOrden.GARANTIA]: {
    label: 'En Garantía',
    variant: 'default',
  },
};

interface StatusBadgeProps {
  estado: EstadoOrden;
}

export function StatusBadge({ estado }: StatusBadgeProps) {
  const config = estadoConfig[estado];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
