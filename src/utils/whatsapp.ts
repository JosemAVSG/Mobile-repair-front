// ──────────────────────────────────────────────
// WhatsApp helpers (mensajes de entrega)
// ──────────────────────────────────────────────

import type { EstadoOrden } from '../types';

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

export interface MensajeEstadoParams {
  clienteNombre: string;
  nombreTaller: string;
  fechaEntrega?: string | null;
}

/**
 * Mensaje breve y neutro según el estado de la orden. Para ESPERANDO_ENTREGA
 * con fecha agendada reutiliza el texto de cita; el resto de estados usa un
 * aviso genérico. Siempre cierra con "— {nombreTaller}".
 */
export function buildMensajeEstado(
  estado: EstadoOrden,
  { clienteNombre, nombreTaller, fechaEntrega }: MensajeEstadoParams,
): string {
  const saludo = `Hola ${clienteNombre}`;
  const cierre = `— ${nombreTaller}`;

  switch (estado) {
    case 'REGISTRO':
      return `${saludo}, recibimos tu equipo y quedó registrado. ${cierre}`;
    case 'DIAGNOSTICO':
      return `${saludo}, estamos revisando tu equipo (diagnóstico). ${cierre}`;
    case 'REPARACION':
      return `${saludo}, tu equipo está en reparación. ${cierre}`;
    case 'ESPERANDO_REPUESTO':
      return `${saludo}, estamos esperando un repuesto para continuar con tu reparación. ${cierre}`;
    case 'REPARACION_COMPLETADA':
    case 'CONTROL_CALIDAD':
      return `${saludo}, la reparación avanzó y está en control de calidad. ${cierre}`;
    case 'ESPERANDO_ENTREGA':
      if (fechaEntrega) {
        return buildMensajeCita({
          tipo: 'agendar',
          clienteNombre,
          fechaEntrega,
          nombreTaller,
        });
      }
      return `${saludo}, tu equipo está listo para retirar. ${cierre}`;
    case 'PAGADO':
      return `${saludo}, registramos tu pago; coordina el retiro de tu equipo. ${cierre}`;
    case 'PRESUPUESTO_RECHAZADO':
      return `${saludo}, el presupuesto fue rechazado; puedes pasar por tu equipo. ${cierre}`;
    case 'DEVUELTO':
      return `${saludo}, tu equipo fue devuelto. ${cierre}`;
    case 'ENTREGADO':
      return `${saludo}, gracias por tu preferencia. ${cierre}`;
    case 'GARANTIA':
      return `${saludo}, estamos atendiendo tu garantía. ${cierre}`;
    default:
      return `${saludo}, te informamos sobre el avance de tu reparación. ${cierre}`;
  }
}

/**
 * Construye el enlace de WhatsApp. Normaliza el teléfono quitando TODO
 * carácter no numérico. Si la cadena ORIGINAL contenía un `+` en cualquier
 * posición se antepone un `+` al resultado, de modo que formatos como
 * "(+57) 300 1234567" conserven el carácter internacional. Si no queda
 * ningún dígito se devuelve `https://wa.me/?text=...` (número vacío) sin
 * lanzar, para no romper el flujo de la UI ante un teléfono ausente.
 *
 * IMPORTANTE: el número debe venir en formato internacional (p. ej.
 * "+57 300 1234567"). Si no incluye `+` NO se antepone ningún código de
 * país: `wa.me` recibiría un número local inválido.
 */
export function buildWhatsAppLink(telefono: string, mensaje: string): string {
  const trimmed = (telefono ?? '').trim();
  const hasPlus = trimmed.includes('+');
  const digits = trimmed.replace(/\D/g, '');
  const numero = hasPlus ? `+${digits}` : digits;
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