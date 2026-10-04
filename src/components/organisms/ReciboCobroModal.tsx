import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { useConfig } from '../../context/ConfigContext';
import { PRODUCT_NAME } from '../../utils/brand';
import { formatCop, formatDateTime } from '../../utils/formatters';
import type { Cobro } from '../../types';

interface ReciboCobroModalProps {
  cobro: Cobro | null;
  onClose: () => void;
}

const PLAN_LABEL: Record<string, string> = { BASICO: 'Básico', PRO: 'Pro' };

const printStyles = `
  @media print {
    body * { visibility: hidden; }
    #recibo-print, #recibo-print * { visibility: visible; }
    #recibo-print { position: absolute; left: 0; top: 0; width: 100%; }
    #recibo-print .recibo-no-print { display: none !important; }
  }
`;

/**
 * Comprobante de un cobro aprobado de la suscripción. Se imprime o se guarda como PDF desde el
 * diálogo de impresión del navegador. No es una factura electrónica.
 */
export function ReciboCobroModal({ cobro, onClose }: ReciboCobroModalProps) {
  const { config } = useConfig();

  useEffect(() => {
    if (!cobro) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [cobro, onClose]);

  if (!cobro) return null;

  const fecha = formatDateTime(cobro.finalizedAt ?? cobro.createdAt);
  const plan = PLAN_LABEL[cobro.plan] ?? cobro.plan;

  return createPortal(
    <>
      <style>{printStyles}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
        <div
          id="recibo-print"
          className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Comprobante de pago"
        >
          <div className="recibo-no-print flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Comprobante de pago</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div>
              <p className="text-xl font-bold text-slate-900">{PRODUCT_NAME}</p>
              <p className="text-sm text-slate-500">Comprobante de pago de suscripción</p>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Taller</dt>
                <dd className="text-right font-medium text-slate-800">{config.nombreTaller}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Plan</dt>
                <dd className="text-right font-medium text-slate-800">{plan} · mensual</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Fecha de pago</dt>
                <dd className="text-right font-medium text-slate-800">{fecha}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Estado</dt>
                <dd className="text-right font-medium text-green-700">Aprobado</dd>
              </div>
            </dl>

            <div className="flex items-baseline justify-between border-t border-slate-200 pt-4">
              <span className="text-sm text-slate-500">Total pagado</span>
              <span className="text-2xl font-bold text-slate-900">{formatCop(cobro.montoCop)}</span>
            </div>

            <p className="text-xs text-slate-400">
              Pago procesado por Wompi. Este documento es un comprobante de pago y no una factura
              electrónica.
            </p>

            <div className="recibo-no-print flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
              <Button onClick={() => window.print()}>Imprimir / guardar PDF</Button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
