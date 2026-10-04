import { Badge } from '../atoms/Badge';
import type { Cobro } from '../../types';

interface CobroStatusBadgeProps {
  status: Cobro['status'];
}

const LABELS: Record<Cobro['status'], string> = {
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  ERROR: 'Error',
  VOIDED: 'Voided',
  PENDING: 'Payment in process',
  CLAIMED: 'Payment in process',
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
