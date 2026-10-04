import { useState } from 'react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Select } from '../atoms/Select';
import { Spinner } from '../atoms/Spinner';
import { Badge } from '../atoms/Badge';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { CobroStatusBadge } from '../molecules/CobroStatusBadge';
import { MetodoPagoFlow } from './MetodoPagoFlow';
import { HistorialCobros } from './HistorialCobros';
import {
  useCambiarPlan,
  useCancelarSuscripcion,
  useCobros,
  useReactivarSuscripcion,
  useSuscripcion,
} from '../../hooks/useBilling';
import { formatCop, formatDate } from '../../utils/formatters';
import type { PlanSuscripcion } from '../../types';

interface SuscripcionSectionProps {
  defaultEmail?: string;
  autoOpenPaymentFlow?: boolean;
}

const DAY_MS = 86_400_000;

const ESTADO_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  ACTIVO: 'success',
  TRIAL: 'info',
  SUSPENDIDO: 'warning',
  CANCELADO: 'danger',
};

const ESTADO_LABEL: Record<string, string> = {
  ACTIVO: 'Activa',
  TRIAL: 'Prueba gratuita',
  SUSPENDIDO: 'Suspendida',
  CANCELADO: 'Cancelada',
};

const PLAN_OPTIONS = [
  { value: 'BASICO', label: 'Básico' },
  { value: 'PRO', label: 'Pro' },
];

function daysLeft(iso: string): number | null {
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / DAY_MS));
}

export function SuscripcionSection({ defaultEmail, autoOpenPaymentFlow }: SuscripcionSectionProps) {
  const { data: suscripcion, isLoading } = useSuscripcion();
  const { data: cobros = [] } = useCobros(12);
  const cambiarPlan = useCambiarPlan();
  const cancelar = useCancelarSuscripcion();
  const reactivar = useReactivarSuscripcion();

  const [paymentFlowOpen, setPaymentFlowOpen] = useState(autoOpenPaymentFlow ?? false);
  const [paymentFlowRequiresPlan, setPaymentFlowRequiresPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanSuscripcion | ''>('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  if (isLoading) {
    return (
      <section aria-label="Suscripción">
        <Card title="Suscripción">
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        </Card>
      </section>
    );
  }

  if (!suscripcion) {
    return (
      <section aria-label="Suscripción">
        <Card title="Suscripción">
          <p className="text-sm text-slate-600">No hay información de suscripción disponible.</p>
        </Card>
      </section>
    );
  }

  const {
    plan,
    planDisplayName,
    estado,
    trialEndsAt,
    currentPeriodEnd,
    nextChargeAt,
    cancelAtPeriodEnd,
    pendingPlan,
    pendingPlanDisplayName,
    precioCop,
    montoProximoCobroCop,
    metodoPago,
    cobroEnCurso,
    enMora,
    pagosHabilitados,
    features,
    contactoEmpresarial,
  } = suscripcion;

  const isLegacy = plan === 'LEGACY';
  const isEmpresarial = plan === 'EMPRESARIAL' || contactoEmpresarial;
  const isTrial = plan === 'TRIAL';
  const trialDays = isTrial && trialEndsAt ? daysLeft(trialEndsAt) : null;
  const hasCard = metodoPago != null;

  const openPaymentFlow = (requiresPlan: boolean) => {
    setPaymentFlowRequiresPlan(requiresPlan);
    setPaymentFlowOpen(true);
  };

  const handleChangePlan = () => {
    if (selectedPlan) {
      cambiarPlan.mutate(selectedPlan);
      setSelectedPlan('');
    }
  };

  const contactEmail = (import.meta.env.VITE_BILLING_CONTACT_EMAIL as string | undefined) || '';

  return (
    <section aria-label="Suscripción">
      <Card title="Suscripción">
        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-semibold text-slate-800">{planDisplayName}</h4>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {isLegacy ? (
                <Badge variant="default">Plan heredado</Badge>
              ) : (
                <Badge variant={ESTADO_BADGE[estado] ?? 'default'}>
                  {ESTADO_LABEL[estado] ?? estado}
                </Badge>
              )}
              {cobroEnCurso && <CobroStatusBadge status="PENDING" />}
            </div>

            {!isLegacy && precioCop != null && (
              <p className="mt-2 text-sm font-medium text-slate-700">{formatCop(precioCop)}</p>
            )}

            {isTrial && trialDays != null && (
              <p className="mt-2 text-sm text-slate-600">
                {trialDays === 1 ? 'Queda 1 día' : `Quedan ${trialDays} días`} de tu prueba gratuita
                {trialEndsAt ? ` (hasta el ${formatDate(trialEndsAt)})` : ''}.
              </p>
            )}

            {isTrial && trialEndsAt && (
              <p className="mt-1 text-sm text-slate-600">
                Se te cobrará el {formatDate(trialEndsAt)}.
              </p>
            )}

            {!isLegacy && currentPeriodEnd && (
              <p className="mt-2 text-sm text-slate-600">
                Período actual hasta el {formatDate(currentPeriodEnd)}.
              </p>
            )}

            {nextChargeAt && hasCard && (
              <p className="mt-2 text-sm text-slate-600">
                Próximo cobro el {formatDate(nextChargeAt)} en {metodoPago.brand} •••• {metodoPago.last4}
                {montoProximoCobroCop != null ? ` (${formatCop(montoProximoCobroCop)})` : ''}.
              </p>
            )}

            {pendingPlan && pendingPlanDisplayName && nextChargeAt && (
              <p className="mt-2 text-sm text-slate-600">
                {pendingPlanDisplayName} se aplica desde el {formatDate(nextChargeAt)}.
              </p>
            )}

            {cancelAtPeriodEnd && currentPeriodEnd && (
              <p className="mt-2 text-sm text-amber-700">
                Se cancelará el {formatDate(currentPeriodEnd)}.
                <button
                  type="button"
                  onClick={() => reactivar.mutate()}
                  className="ml-2 font-medium text-blue-600 hover:underline"
                >
                  Deshacer cancelación
                </button>
              </p>
            )}

            {enMora && nextChargeAt && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Reintentaremos el {formatDate(nextChargeAt)}. Actualiza tu tarjeta para evitar la suspensión.
              </p>
            )}
          </div>

          {!pagosHabilitados && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Los pagos en línea estarán disponibles pronto.
              {contactEmail && (
                <>
                  {' '}
                  Escribe a <a href={`mailto:${contactEmail}`}>{contactEmail}</a> para recibir ayuda.
                </>
              )}
            </p>
          )}

          {features && features.length > 0 && !isLegacy && (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              <p className="mb-1 font-medium text-slate-700">Incluye</p>
              <ul className="list-inside list-disc space-y-0.5">
                {features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {pagosHabilitados && !isLegacy && !isEmpresarial && (
              <>
                {isTrial && !hasCard && (
                  <Button type="button" onClick={() => openPaymentFlow(true)}>
                    Agregar tarjeta
                  </Button>
                )}

                {(estado === 'SUSPENDIDO' || estado === 'CANCELADO') && (
                  <Button type="button" onClick={() => openPaymentFlow(isTrial || estado === 'CANCELADO')}>
                    {estado === 'SUSPENDIDO' ? 'Actualizar tarjeta y pagar' : 'Reactivar con tarjeta'}
                  </Button>
                )}

                {hasCard && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openPaymentFlow(false)}
                  >
                    Cambiar tarjeta
                  </Button>
                )}

                {(estado === 'ACTIVO' || (isTrial && hasCard)) && (
                  <>
                    <Select
                      options={PLAN_OPTIONS}
                      placeholder="Cambiar plan…"
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value as PlanSuscripcion)}
                      className="w-40"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!selectedPlan}
                      loading={cambiarPlan.isPending}
                      onClick={handleChangePlan}
                    >
                      Cambiar plan
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      Cancelar suscripción
                    </Button>
                  </>
                )}
              </>
            )}

            {isEmpresarial && (
              <a
                href={contactEmail ? `mailto:${contactEmail}` : '#'}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Contactar a ventas
              </a>
            )}
          </div>

          {cobros.length > 0 && <HistorialCobros cobros={cobros} ultimoCobro={suscripcion.ultimoCobro} />}
        </div>
      </Card>

      <MetodoPagoFlow
        open={paymentFlowOpen}
        onClose={() => setPaymentFlowOpen(false)}
        requiresPlan={paymentFlowRequiresPlan}
        defaultEmail={defaultEmail}
      />

      <ConfirmDialog
        isOpen={showCancelDialog}
        title="Cancelar suscripción"
        message="Your access will remain until the end of the current period. Are you sure?"
        confirmLabel="Confirmar"
        cancelLabel="Volver"
        onConfirm={() => {
          cancelar.mutate();
          setShowCancelDialog(false);
        }}
        onCancel={() => setShowCancelDialog(false)}
        loading={cancelar.isPending}
        variant="warning"
      />
    </section>
  );
}
