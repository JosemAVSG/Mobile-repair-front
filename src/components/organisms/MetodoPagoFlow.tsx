import { useEffect, useState } from 'react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Modal } from '../atoms/Modal';
import { Select } from '../atoms/Select';
import { Spinner } from '../atoms/Spinner';
import { WompiTermsCheckboxes } from '../molecules/WompiTermsCheckboxes';
import { useRegistrarMetodoPago, useWompiAcceptance } from '../../hooks/useBilling';
import { tokenizeCard } from '../../lib/wompiWidget';
import { ApiError } from '../../api/ApiClient';
import type { PlanSuscripcion } from '../../types';

interface MetodoPagoFlowProps {
  open: boolean;
  onClose: () => void;
  requiresPlan?: boolean;
  initialPlan?: PlanSuscripcion;
  defaultEmail?: string;
}

const PLAN_OPTIONS: { value: PlanSuscripcion; label: string }[] = [
  { value: 'BASICO', label: 'Básico' },
  { value: 'PRO', label: 'Pro' },
];

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
  const { mutate: registrar, isPending, isSuccess, error } = useRegistrarMetodoPago();

  const [termsChecked, setTermsChecked] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [plan, setPlan] = useState<PlanSuscripcion | ''>(initialPlan ?? '');

  // Reset form state whenever the flow opens.
  useEffect(() => {
    if (open) {
      setTermsChecked(false);
      setEmail(defaultEmail);
      setPlan(initialPlan ?? '');
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
    (!requiresPlan || plan !== '');

  const handleSubmit = async () => {
    if (!canSubmit || !acceptance) return;

    const cardToken = await tokenizeCard({ publicKey: acceptance.publicKey });
    // Silent no-op when the user closes the widget without producing a token.
    if (!cardToken) return;

    registrar({
      cardToken,
      acceptanceToken: acceptance.acceptanceToken,
      personalAuthToken: acceptance.personalAuthToken,
      email: email.trim(),
      plan: requiresPlan && plan ? plan : undefined,
    });
  };

  const errorMessage = apiErrorMessage(error);

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
              options={PLAN_OPTIONS}
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanSuscripcion)}
              disabled={isPending}
            />
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={isPending} disabled={!canSubmit}>
              Agregar tarjeta
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
