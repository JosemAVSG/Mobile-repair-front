import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { StatusBadge } from '../molecules/StatusBadge';
import { formatCurrency, formatDateTime, tipoDispositivoLabel } from '../../utils/formatters';
import type { OrdenTrabajo, Cliente, Marca, Modelo } from '../../types';

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

interface FacturaModalProps {
  isOpen: boolean;
  orden: OrdenTrabajo | null;
  cliente?: Cliente | null;
  marca?: Marca | null;
  modelo?: Modelo | null;
  onClose: () => void;
}

// ──────────────────────────────────────────────
// FacturaModal
// ──────────────────────────────────────────────

export function FacturaModal({
  isOpen,
  orden,
  cliente,
  marca,
  modelo,
  onClose,
}: FacturaModalProps) {
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

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #factura-print, #factura-print * { visibility: visible; }
      #factura-print {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }
      #factura-print .factura-no-print { display: none !important; }
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
          id="factura-print"
          className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Factura"
        >
          {/* Toolbar (hidden on print) */}
          <div className="factura-no-print flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Factura</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Cerrar"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          {/* Invoice body */}
          <div className="px-6 py-6">
            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">
                FACTURA
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-700">
                Taller de Reparaciones
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDateTime(orden.fechaEntrada)}
              </p>
            </div>

            <div className="divide-y divide-slate-200 border-t border-b border-slate-300">
              <Row label="N° de Orden" value={`#${orden.id}`} />
              <Row label="Cliente" value={cliente?.nombre ?? `Cliente #${orden.clienteId}`} />
              <Row label="Equipo" value={equipoLabel} />
              {imei && <Row label="IMEI" value={imei} />}
              {serie && <Row label="N° de Serie" value={serie} />}
              {orden.falloReportado && <Row label="Fallo Reportado" value={orden.falloReportado} />}
              <Row
                label="Estado"
                value={
                  <span className="inline-block">
                    <StatusBadge estado={orden.estado} />
                  </span>
                }
              />
            </div>

            {/* Total */}
            <div className="mt-6 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">
                Costo de Revisión
              </span>
              <span className="text-xl font-bold text-blue-600">
                {orden.precioTotal != null
                  ? formatCurrency(orden.precioTotal)
                  : '—'}
              </span>
            </div>
          </div>

          {/* Footer buttons (hidden on print) */}
          <div className="factura-no-print flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
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

// ──────────────────────────────────────────────
// Row
// ──────────────────────────────────────────────

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-800">{value}</span>
    </div>
  );
}
