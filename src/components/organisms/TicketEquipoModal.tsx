import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { formatDate, tipoDispositivoLabel } from '../../utils/formatters';
import type { OrdenTrabajo, Marca, Modelo } from '../../types';

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

interface TicketEquipoModalProps {
  isOpen: boolean;
  orden: OrdenTrabajo | null;
  marca?: Marca | null;
  modelo?: Modelo | null;
  onClose: () => void;
}

// ──────────────────────────────────────────────
// TicketEquipoModal
// ──────────────────────────────────────────────

export function TicketEquipoModal({
  isOpen,
  orden,
  marca,
  modelo,
  onClose,
}: TicketEquipoModalProps) {
  // Escape closes the modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !orden) return null;

  const equipoParts: string[] = [];
  const tipo = orden.tipo;
  if (tipo) equipoParts.push(tipoDispositivoLabel(tipo) ?? tipo);
  if (marca?.nombre) equipoParts.push(marca.nombre);
  if (modelo?.nombre) equipoParts.push(modelo.nombre);
  const equipoLabel = equipoParts.join(' - ') || '—';

  const imei = orden.imei;
  const serie = orden.numeroSerie;
  const qrValue = `${window.location.origin}/ordenes/${orden.id}`;

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #ticket-print, #ticket-print * { visibility: visible; }
      #ticket-print {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }
      #ticket-print .ticket-no-print { display: none !important; }
    }
  `;

  return createPortal(
    <>
      <style>{printStyles}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          id="ticket-print"
          className="relative z-10 w-full max-w-[320px] rounded-xl bg-white shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Ticket QR de Equipo"
        >
          {/* Toolbar (hidden on print) */}
          <div className="ticket-no-print flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Ticket QR de Equipo
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Cerrar"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          {/* Sticker body */}
          <div className="px-5 py-6">
            {/* Header */}
            <div className="mb-4 text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-slate-900">
                Taller de Reparaciones
              </p>
              <p className="mt-1 text-xs font-medium text-slate-700">
                N° de Orden: #{orden.id}
              </p>
            </div>

            {/* QR */}
            <div className="flex justify-center">
              <div className="rounded-lg border border-slate-200 p-2">
                <QRCodeSVG value={qrValue} size={140} />
              </div>
            </div>

            {/* Data below QR */}
            <div className="mt-4 space-y-2 text-center">
              <p className="text-sm font-medium text-slate-800">
                {equipoLabel}
              </p>
              <div className="space-y-1 text-xs text-slate-600">
                <p>Cliente: {orden.clienteId != null ? `Cliente #${orden.clienteId}` : '—'}</p>
                {imei && <p>IMEI: {imei}</p>}
                {serie && <p>N° de Serie: {serie}</p>}
              </div>
            </div>

            {/* Footer */}
            <p className="mt-4 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">
              Registrado: {formatDate(orden.fechaEntrada)}
            </p>
          </div>

          {/* Footer buttons (hidden on print) */}
          <div className="ticket-no-print flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
