// ──────────────────────────────────────────────
// WhatsApp helpers (mensajes de entrega)
// ──────────────────────────────────────────────

export interface MensajeCitaParams {
  tipo: 'agendar' | 'reprogramar';
  clienteNombre: string;
  fechaEntrega: string;
  nombreTaller: string;
}

interface FechaHora {
  fecha: string;
  hora: string;
}

/** ISO → fecha ("20/08/2026") y hora ("14:30") en español neutro. */
function formatFechaHora(iso: string): FechaHora {
  const date = new Date(iso);
  const fecha = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const hora = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return { fecha, hora };
}

/**
 * Mensaje de cita de entrega (agendar o reprogramar) en español neutro.
 */
export function buildMensajeCita({
  tipo,
  clienteNombre,
  fechaEntrega,
  nombreTaller,
}: MensajeCitaParams): string {
  const { fecha, hora } = formatFechaHora(fechaEntrega);
  if (tipo === 'reprogramar') {
    return `Hola ${clienteNombre}, tu cita de entrega fue reprogramada para el ${fecha} a las ${hora}. Disculpa las molestias. — ${nombreTaller}`;
  }
  return `Hola ${clienteNombre}, te informamos que tu reparación estará lista para retirar el ${fecha} a las ${hora}. ¡Te esperamos! — ${nombreTaller}`;
}

/**
 * Aviso general de entrega (cuando aún no hay cita agendada).
 */
export function buildMensajeEntregaGeneral({
  clienteNombre,
  nombreTaller,
}: {
  clienteNombre: string;
  nombreTaller: string;
}): string {
  return `Hola ${clienteNombre}, te informamos que tu reparación está lista para retirar. ¡Te esperamos! — ${nombreTaller}`;
}

/**
 * Construye el enlace de WhatsApp. Normaliza el teléfono quitando espacios,
 * guiones y paréntesis; conserva el `+` inicial (formato internacional).
 */
export function buildWhatsAppLink(telefono: string, mensaje: string): string {
  const numero = telefono.replace(/[\s\-()]/g, '');
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Copia texto al portapapeles con fallback a execCommand cuando la API de
 * clipboard no está disponible o falla.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // continúa con el fallback
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}