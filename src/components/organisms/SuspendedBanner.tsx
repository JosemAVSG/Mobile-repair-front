import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const COPY = {
  SUSPENDIDO: {
    title: 'Subscription suspended',
    message: 'Your subscription is suspended. Update your card to continue.',
  },
  CANCELADO: {
    title: 'Subscription cancelled',
    message: 'Your subscription was cancelled. Update your card to reactivate your shop.',
  },
} as const;

/**
 * Banner global de facturación. Lee SOLO del AuthContext (montado en la raíz): el
 * evento 'fixtra:billing-block' lo captura el provider, así no se pierde si se emite
 * durante el /me del mount, antes de que este componente exista.
 */
export function SuspendedBanner() {
  const { billingBlocked, billingBlock, isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !billingBlocked) return null;

  // El codigo del 403 manda (trial vencido colapsa a SUSPENDIDO, A-SP2); si no hubo
  // 403, el estado del usuario. El copy preferido es el mensaje del backend.
  const codigo = billingBlock?.codigo ?? (user?.estado === 'CANCELADO' ? 'CANCELADO' : 'SUSPENDIDO');
  const { title, message: fallback } = COPY[codigo];
  const copy = billingBlock?.message || fallback;

  return (
    <div role="alert" className="w-full bg-amber-500 px-4 py-2 text-sm text-white">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <strong>{title}</strong>: {copy}
        </div>
        <Link to="/configuracion?pagar=1" className="font-medium underline">
          Update card
        </Link>
      </div>
    </div>
  );
}
