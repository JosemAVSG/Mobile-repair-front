import { useEffect, useRef, useState } from 'react';

export const POLL_CAP_MS = 120_000;

/**
 * Observa el estado de la suscripción para:
 *  - avisar cuando el polling de 2 minutos se agota con el cobro aún en curso;
 *  - refrescar /me (evento 'fixtra:refresh-me') cuando el cobro termina o el
 *    estado cambia, para que AuthContext limpie el bloqueo sin recargar.
 */
export function useCobroEnCursoWatch(
  cobroEnCurso: boolean | undefined,
  estado: string | undefined,
): { pollTimedOut: boolean } {
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const prevCobro = useRef<boolean | undefined>(undefined);
  const prevEstado = useRef<string | undefined>(undefined);

  useEffect(() => {
    const cobroFinished = prevCobro.current === true && cobroEnCurso === false;
    const estadoChanged =
      prevEstado.current !== undefined && estado !== undefined && prevEstado.current !== estado;
    if (cobroFinished || estadoChanged) {
      window.dispatchEvent(new CustomEvent('fixtra:refresh-me'));
    }
    if (estado !== undefined) prevEstado.current = estado;
    if (cobroEnCurso !== undefined) prevCobro.current = cobroEnCurso;
  }, [cobroEnCurso, estado]);

  useEffect(() => {
    if (!cobroEnCurso) {
      setPollTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setPollTimedOut(true), POLL_CAP_MS);
    return () => window.clearTimeout(timer);
  }, [cobroEnCurso]);

  return { pollTimedOut: Boolean(cobroEnCurso) && pollTimedOut };
}
