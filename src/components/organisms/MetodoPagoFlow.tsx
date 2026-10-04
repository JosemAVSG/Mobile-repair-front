import { useEffect, useRef, useState } from 'react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Modal } from '../atoms/Modal';
import { Select } from '../atoms/Select';
import { Spinner } from '../atoms/Spinner';
import { WompiTermsCheckboxes } from '../molecules/WompiTermsCheckboxes';
import { usePlanes, useRegistrarMetodoPago, useWompiAcceptance } from '../../hooks/useBilling';
import { tokenizeCard } from '../../lib/wompiWidget';
import { formatCop } from '../../utils/formatters';
import { ApiError } from '../../api/ApiClient';
import type { PlanSuscripcion } from '../../types';

interface MetodoPagoFlowProps {
  open: boolean;
  onClose: () => void;
  requiresPlan?: boolean;
  initialPlan?: PlanSuscripcion;
  defaultEmail?: string;
}

function apiErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return 'Servicio de pagos no disponible, intenta de nuevo.';
    }
    return error.message;
  }
  return error.message;
}

export function MetodoPagoFlow({
  open,
  onClose,
  requiresPlan = false,
  initialPlan,
  defaultEmail = '',
}: MetodoPagoFlowProps) {
  const {
    data: acceptance,
    isLoading: loadingAcceptance,
    error: acceptanceError,
  } = useWompiAcceptance(open);
  const { data: planes } = usePlanes();
  const { mutate: registrar, isPending, isSuccess, error } = useRegistrarMetodoPago();

  const [termsChecked, setTermsChecked] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [plan, setPlan] = useState<PlanSuscripcion | ''>(initialPlan ?? '');
  const [tokenizing, setTokenizing] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef(0);

  const planOptions = planes.map((p) => ({ value: p.plan, label: `${p.nombre} · ${formatCop(p.precioCop)}/mes` }));
  const selectedPlanInfo = planes.find((p) => p.plan === plan);

  // Reset form state only when the flow goes from closed to open: a change of defaultEmail or
  // initialPlan while the user is filling the form must not wipe the checkboxes.
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) {
      setTermsChecked(false);
      setEmail(defaultEmail);
      setPlan(initialPlan ?? '');
      setWidgetError(null);
      setDismissed(false);
      // Un intento anterior que nunca respondió no debe dejar el botón en "cargando".
      attempt.current += 1;
      inFlight.current = false;
      setTokenizing(false);
    }
  }, [open, defaultEmail, initialPlan]);

  // Close the modal once the registration succeeded; the parent will see the
  // updated subscription via react-query invalidation + polling.
  useEffect(() => {
    if (isSuccess && open) {
      onClose();
    }
  }, [isSuccess, open, onClose]);

  const canSubmit =
    termsChecked &&
    email.trim().length > 0 &&
    acceptance != null &&
    (!requiresPlan || plan !== '') &&
    !tokenizing &&
    !isPending;

  const handleSubmit = async () => {
    if (inFlight.current || !canSubmit || !acceptance) return;
    inFlight.current = true;
    const myAttempt = ++attempt.current;
    setTokenizing(true);
    setWidgetError(null);
    setDismissed(false);

    let cardToken: string | null;
    try {
      cardToken = await tokenizeCard({ publicKey: acceptance.publicKey });
    } catch {
      if (myAttempt !== attempt.current) return;
      setWidgetError('No pudimos cargar el formulario de pago. Intenta de nuevo.');
      inFlight.current = false;
      setTokenizing(false);
      return;
    }
    // Respuesta de un intento anterior (el modal se cerró y reabrió): se descarta.
    if (myAttempt !== attempt.current) return;
    inFlight.current = false;
    setTokenizing(false);
    // El usuario cerró el widget sin tokenizar: no es un error, pero se le avisa.
    if (!cardToken) {
      setDismissed(true);
      return;
    }

    registrar({
      cardToken,
      acceptanceToken: acceptance.acceptanceToken,
      personalAuthToken: acceptance.personalAuthToken,
      email: email.trim(),
      plan: requiresPlan && plan ? plan : undefined,
    });
  };

  // Por qué está deshabilitado "Agregar tarjeta": el botón solo se apaga cuando falta algo.
  const missing = !termsChecked
    ? 'Acepta los dos términos de Wompi para continuar.'
    : email.trim().length === 0
      ? 'Escribe tu correo electrónico para continuar.'
      : requiresPlan && plan === ''
        ? 'Elige un plan para continuar.'
        : null;

  // Salida manual por si no detectamos que el usuario cerró el widget: descarta el intento en curso.
  const cancelAttempt = () => {
    attempt.current += 1;
    inFlight.current = false;
    setTokenizing(false);
    setDismissed(true);
  };

  const errorMessage = widgetError ?? apiErrorMessage(error);

  return (
    <Modal isOpen={open} onClose={onClose} title="Agregar método de pago" size="md">
      {loadingAcceptance ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
          <span className="ml-2 text-sm text-slate-600">Cargando términos de Wompi…</span>
        </div>
      ) : acceptanceError || !acceptance ? (
        <div className="space-y-4">
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {apiErrorMessage(acceptanceError) ??
              'Servicio de pagos no disponible, intenta de nuevo.'}
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Agrega una tarjeta de débito o crédito para activar tu suscripción. Wompi procesa los datos de la tarjeta;
            nosotros nunca los guardamos ni registramos.
          </p>

          <Input
            type="email"
            label="Correo electrónico"
            placeholder="facturacion@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
          />

          {requiresPlan && (
            <Select
              label="Plan"
              placeholder="Selecciona un plan…"
              options={planOptions}
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanSuscripcion)}
              disabled={isPending}
            />
          )}

          {selectedPlanInfo && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Plan <strong>{selectedPlanInfo.nombre}</strong>: {formatCop(selectedPlanInfo.precioCop)} al mes, con
              cobro automático a esta tarjeta. Puedes cancelar cuando quieras desde Configuración.
            </p>
          )}

          <WompiTermsCheckboxes
            acceptance={acceptance}
            checked={termsChecked}
            onChange={setTermsChecked}
            disabled={isPending}
          />

          {errorMessage && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          {dismissed && !errorMessage && (
            <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Cerraste el formulario de Wompi y la tarjeta no se agregó. Puedes intentarlo de nuevo.
            </p>
          )}

          {tokenizing && !isPending && (
            <p className="text-right text-xs text-slate-500">
              ¿Cerraste la ventana de Wompi?{' '}
              <button type="button" onClick={cancelAttempt} className="font-medium text-blue-600 hover:underline">
                Reintentar
              </button>
            </p>
          )}

          {missing && !isPending && !tokenizing && <p className="text-right text-xs text-slate-500">{missing}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={isPending || tokenizing} disabled={!canSubmit}>
              Agregar tarjeta
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
