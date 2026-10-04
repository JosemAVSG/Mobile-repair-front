import { Badge } from '../atoms/Badge';
import type { Cobro } from '../../types';

interface CobroStatusBadgeProps {
  status: Cobro['status'];
}

const LABELS: Record<Cobro['status'], string> = {
  APPROVED: 'Aprobado',
  DECLINED: 'Rechazado',
  ERROR: 'Error',
  VOIDED: 'Anulado',
  PENDING: 'Pago en proceso',
  CLAIMED: 'Pago en proceso',
};

const VARIANTS: Record<Cobro['status'], 'success' | 'danger' | 'warning' | 'info'> = {
  APPROVED: 'success',
  DECLINED: 'danger',
  ERROR: 'danger',
  VOIDED: 'warning',
  PENDING: 'info',
  CLAIMED: 'info',
};

export function CobroStatusBadge({ status }: CobroStatusBadgeProps) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
