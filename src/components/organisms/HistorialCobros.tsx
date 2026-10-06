import { useState } from 'react';
import { IconActionButton } from '../molecules/IconActionButton';
import { ReciboCobroModal } from './ReciboCobroModal';
import { CobroStatusBadge } from '../molecules/CobroStatusBadge';
import { formatCop, formatDate } from '../../utils/formatters';
import type { Cobro } from '../../types';

interface HistorialCobrosProps {
  cobros: Cobro[];
  ultimoCobro?: Cobro | null;
}

export function HistorialCobros({ cobros, ultimoCobro }: HistorialCobrosProps) {
  const [recibo, setRecibo] = useState<Cobro | null>(null);
  const newestFirst = [...cobros].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium text-slate-700">Historial de pagos</h5>

      {ultimoCobro?.status === 'DECLINED' && ultimoCobro.statusMessage && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          Último cobro: {ultimoCobro.statusMessage}
        </p>
      )}

      {newestFirst.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay pagos registrados.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {newestFirst.map((cobro, idx) => (
            <li key={`${cobro.createdAt}-${idx}`} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-800">{formatCop(cobro.montoCop)}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(cobro.createdAt)} · {cobro.plan}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {cobro.status === 'APPROVED' && (
                  <IconActionButton icon="eye" label="Ver comprobante" onClick={() => setRecibo(cobro)} />
                )}
                <CobroStatusBadge status={cobro.status} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReciboCobroModal cobro={recibo} onClose={() => setRecibo(null)} />
    </div>
  );
}
