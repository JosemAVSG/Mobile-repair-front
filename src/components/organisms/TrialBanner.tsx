import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const DAY_MS = 86_400_000;
const WARN_DAYS = 7;

/**
 * Aviso de fin de prueba para el ADMIN. Lee del AuthContext (no hace requests) y solo aparece
 * cuando quedan pocos días, para llevar al usuario a elegir plan antes de que se bloquee.
 */
export function TrialBanner() {
  const { user, isAuthenticated, billingBlocked } = useAuth();

  if (!isAuthenticated || billingBlocked || user?.rol !== 'ADMIN') return null;
  if (user.estado !== 'TRIAL' || !user.trialEndsAt) return null;

  const end = new Date(user.trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  const days = Math.max(0, Math.ceil((end - Date.now()) / DAY_MS));
  if (days > WARN_DAYS) return null;

  const when = days === 0 ? 'Tu prueba gratuita termina hoy' : days === 1 ? 'Queda 1 día de prueba gratuita' : `Quedan ${days} días de prueba gratuita`;

  return (
    <div role="status" className="w-full bg-blue-600 px-4 py-2 text-sm text-white">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <strong>{when}.</strong> Elige un plan para seguir usando Fixtra sin interrupciones.
        </div>
        <Link to="/configuracion" className="font-medium underline">
          Elegir plan
        </Link>
      </div>
    </div>
  );
}
