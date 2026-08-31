import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { formatDate, tipoDispositivoLabel } from '../../utils/formatters';
import { useConfig } from '../../context/ConfigContext';
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

type TicketKind = 'customer' | 'technician';

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
  const { config } = useConfig();
  const [ticket, setTicket] = useState<TicketKind>('customer');

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

  const customerQrValue = `${window.location.origin}/estado/${orden.id}`;
  const technicianQrValue = `${window.location.origin}/reparaciones/${orden.id}`;

  const printTargetId =
    ticket === 'customer' ? 'ticket-print-customer' : 'ticket-print-technician';

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #${printTargetId}, #${printTargetId} * { visibility: visible; }
      #${printTargetId} {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }
      #${printTargetId} .ticket-no-print { display: none !important; }
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
          className="relative z-10 w-full max-w-[380px] rounded-xl bg-white shadow-xl"
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

          {/* Ticket switcher (hidden on print) */}
          <div className="ticket-no-print grid grid-cols-2 gap-2 px-5 pt-4">
            <button
              onClick={() => setTicket('customer')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                ticket === 'customer'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Para el cliente
            </button>
            <button
              onClick={() => setTicket('technician')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                ticket === 'technician'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Para el técnico
            </button>
          </div>

          {/* Ticket body */}
          <div className="px-5 py-6">
            {ticket === 'customer' ? (
              <div
                id="ticket-print-customer"
                className="rounded-xl border border-slate-200 p-4"
              >
                {/* Header */}
                <div className="mb-4 text-center">
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-900">
                    {config.nombreTaller}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-700">
                    N° de Reparación: #{orden.id}
                  </p>
                </div>

                {/* QR */}
                <div className="flex justify-center">
                  <div className="rounded-lg border border-slate-200 p-2">
                    <QRCodeSVG value={customerQrValue} size={140} />
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

                {/* Footer buttons (hidden on print) */}
                <div className="ticket-no-print mt-4 flex items-center justify-end gap-3">
                  <Button variant="secondary" onClick={onClose}>
                    Cerrar
                  </Button>
                  <Button onClick={() => window.print()}>Imprimir</Button>
                </div>
              </div>
            ) : (
              <div
                id="ticket-print-technician"
                className="rounded-xl border border-slate-200 p-4"
              >
                {/* Header */}
                <div className="mb-4 text-center">
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-900">
                    {config.nombreTaller}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-700">
                    Ticket Técnico · Reparación #{orden.id}
                  </p>
                </div>

                {/* QR */}
                <div className="flex justify-center">
                  <div className="rounded-lg border border-slate-200 p-2">
                    <QRCodeSVG value={technicianQrValue} size={140} />
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

                {/* Footer buttons (hidden on print) */}
                <div className="ticket-no-print mt-4 flex items-center justify-end gap-3">
                  <Button variant="secondary" onClick={onClose}>
                    Cerrar
                  </Button>
                  <Button onClick={() => window.print()}>Imprimir</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
