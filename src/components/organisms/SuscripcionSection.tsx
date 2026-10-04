import { useState } from 'react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Spinner } from '../atoms/Spinner';
import { Badge } from '../atoms/Badge';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { CobroStatusBadge } from '../molecules/CobroStatusBadge';
import { MetodoPagoFlow } from './MetodoPagoFlow';
import { HistorialCobros } from './HistorialCobros';
import { PlanesCards } from './PlanesCards';
import { clearPlanIntent, getPlanIntent } from '../../lib/planIntent';
import {
  useCambiarPlan,
  useCancelarSuscripcion,
  useCobros,
  usePlanes,
  useReactivarSuscripcion,
  useSuscripcion,
} from '../../hooks/useBilling';
import { useCobroEnCursoWatch } from '../../hooks/useCobroEnCursoWatch';
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

function daysLeft(iso: string): number | null {
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / DAY_MS));
}

export function SuscripcionSection({ defaultEmail, autoOpenPaymentFlow }: SuscripcionSectionProps) {
  const { data: suscripcion, isLoading } = useSuscripcion();
  const blocked = suscripcion?.estado === 'SUSPENDIDO' || suscripcion?.estado === 'CANCELADO';
  // /api/billing/cobros no es ruta de recuperación: 403 para tenants bloqueados.
  const { data: cobros = [] } = useCobros(12, !blocked);
  const { pollTimedOut } = useCobroEnCursoWatch(suscripcion?.cobroEnCurso, suscripcion?.estado);
  const cambiarPlan = useCambiarPlan();
  const cancelar = useCancelarSuscripcion();
  const reactivar = useReactivarSuscripcion();
  const { data: planes } = usePlanes();

  const [paymentFlowOpen, setPaymentFlowOpen] = useState(autoOpenPaymentFlow ?? false);
  const [paymentFlowRequiresPlan, setPaymentFlowRequiresPlan] = useState(false);
  const [paymentFlowInitialPlan, setPaymentFlowInitialPlan] = useState<PlanSuscripcion | undefined>();
  const [planToConfirm, setPlanToConfirm] = useState<PlanSuscripcion | null>(null);
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
  } = suscripcion;

  const isLegacy = plan === 'LEGACY';
  const isTrial = plan === 'TRIAL';
  const trialDays = isTrial && trialEndsAt ? daysLeft(trialEndsAt) : null;
  const hasCard = metodoPago != null;

  const openPaymentFlow = (requiresPlan: boolean, initialPlan?: PlanSuscripcion) => {
    setPaymentFlowRequiresPlan(requiresPlan);
    setPaymentFlowInitialPlan(initialPlan);
    setPaymentFlowOpen(true);
  };

  // Con tarjeta y suscripción viva el plan se cambia directo; si no, se pasa por el flujo de pago.
  const canSwitchPlan = hasCard && (estado === 'ACTIVO' || isTrial);
  const showPlanes = pagosHabilitados && !isLegacy && planes.length > 0;
  // Ya contrató un plan: la sugerencia de la landing deja de tener sentido.
  if (estado === 'ACTIVO' && hasCard) clearPlanIntent();

  const planToConfirmInfo = planes.find((p) => p.plan === planToConfirm);

  const handleSelectPlan = (target: PlanSuscripcion) => {
    if (canSwitchPlan) {
      setPlanToConfirm(target);
    } else {
      openPaymentFlow(true, target);
    }
  };

  const handleConfirmPlan = () => {
    if (planToConfirm) {
      cambiarPlan.mutate(planToConfirm);
      setPlanToConfirm(null);
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

          {showPlanes && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-slate-700">Planes</h5>
              <PlanesCards
                planes={planes}
                currentPlan={estado === 'ACTIVO' ? plan : null}
                pendingPlan={pendingPlan}
                suggestedPlan={estado === 'ACTIVO' ? null : getPlanIntent()}
                actionLabel={canSwitchPlan ? 'Cambiar a' : 'Elegir'}
                disabled={cambiarPlan.isPending}
                onSelect={handleSelectPlan}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {pagosHabilitados && !isLegacy && (
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

          </div>

          {cobroEnCurso && pollTimedOut && (
            <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              Tu pago sigue en proceso. Te avisaremos cuando se confirme; vuelve a revisar en unos minutos.
            </p>
          )}

          {cobros.length > 0 ? (
            <HistorialCobros cobros={cobros} ultimoCobro={suscripcion.ultimoCobro} />
          ) : (
            suscripcion.ultimoCobro && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h5 className="text-sm font-medium text-slate-700">Último cobro</h5>
                  <CobroStatusBadge status={suscripcion.ultimoCobro.status} />
                </div>
                {suscripcion.ultimoCobro.statusMessage && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    {suscripcion.ultimoCobro.statusMessage}
                  </p>
                )}
              </div>
            )
          )}
        </div>
      </Card>

      <MetodoPagoFlow
        open={paymentFlowOpen}
        onClose={() => setPaymentFlowOpen(false)}
        requiresPlan={paymentFlowRequiresPlan}
        initialPlan={paymentFlowInitialPlan}
        defaultEmail={defaultEmail}
      />

      <ConfirmDialog
        isOpen={planToConfirm != null}
        title="Cambiar de plan"
        message={`Pasarás al plan ${planToConfirmInfo?.nombre ?? ''}${
          planToConfirmInfo ? ` (${formatCop(planToConfirmInfo.precioCop)} / mes)` : ''
        }. El cambio se aplica desde tu próximo cobro${nextChargeAt ? `, el ${formatDate(nextChargeAt)}` : ''}.`}
        confirmLabel="Confirmar cambio"
        cancelLabel="Volver"
        onConfirm={handleConfirmPlan}
        onCancel={() => setPlanToConfirm(null)}
        loading={cambiarPlan.isPending}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={showCancelDialog}
        title="Cancelar suscripción"
        message="Mantendrás el acceso hasta el final del período actual. ¿Seguro que quieres cancelar?"
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
