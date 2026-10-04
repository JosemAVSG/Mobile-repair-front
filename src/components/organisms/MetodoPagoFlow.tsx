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
  { value: 'BASICO', label: 'Basic' },
  { value: 'PRO', label: 'Pro' },
];

function apiErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return 'Payment service unavailable, please try again.';
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
    <Modal isOpen={open} onClose={onClose} title="Add payment method" size="md">
      {loadingAcceptance ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
          <span className="ml-2 text-sm text-slate-600">Loading Wompi acceptance tokens…</span>
        </div>
      ) : acceptanceError || !acceptance ? (
        <div className="space-y-4">
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {apiErrorMessage(acceptanceError) ??
              'Payment service unavailable, please try again.'}
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Add a debit or credit card to activate your subscription. Card data is handled by Wompi;
            we never store or log it.
          </p>

          <Input
            type="email"
            label="Email"
            placeholder="billing@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
          />

          {requiresPlan && (
            <Select
              label="Plan"
              placeholder="Select a plan…"
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
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={isPending} disabled={!canSubmit}>
              Add card
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
