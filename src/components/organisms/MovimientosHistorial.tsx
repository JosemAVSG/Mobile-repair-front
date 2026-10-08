import { Link } from 'react-router-dom';
import { Card } from '../atoms/Card';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import { DataTable, type Column } from './DataTable';
import { useMovimientosInventario } from '../../hooks/useInventory';
import {
  TIPO_MOVIMIENTO_LABELS,
  formatCurrency,
  formatDateTime,
} from '../../utils/formatters';
import type { MovimientoInventario, MovimientosFiltro, ProductoInventario, TipoMovimiento } from '../../types';

interface MovimientosHistorialProps {
  productos: ProductoInventario[];
  filtro: MovimientosFiltro;
  onFiltroChange: (filtro: MovimientosFiltro) => void;
}

const TIPO_FILTER_OPTIONS = (Object.keys(TIPO_MOVIMIENTO_LABELS) as TipoMovimiento[]).map((t) => ({
  value: t,
  label: TIPO_MOVIMIENTO_LABELS[t],
}));

const TIPO_VARIANT: Record<TipoMovimiento, 'success' | 'warning' | 'info'> = {
  COMPRA: 'success',
  USO_REPARACION: 'warning',
  AJUSTE: 'info',
};

interface MovimientoRow {
  id: number;
  fecha: string;
  producto: string;
  tipo: TipoMovimiento;
  cantidad: number;
  costo: number | null;
  usuario: string;
  ordenId: number | null;
  notas: string;
}

/** Cantidad con signo: USO_REPARACION y AJUSTE/SALIDA restan, el resto suma. */
function cantidadConSigno(m: MovimientoInventario): number {
  const resta = m.tipo === 'USO_REPARACION' || (m.tipo === 'AJUSTE' && m.sentido === 'SALIDA');
  return resta ? -Math.abs(m.cantidad) : Math.abs(m.cantidad);
}

export function MovimientosHistorial({ productos, filtro, onFiltroChange }: MovimientosHistorialProps) {
  const { data, isPending, error, refetch } = useMovimientosInventario(filtro);

  const nombres = new Map(productos.map((p) => [p.id, `${p.codigo} · ${p.nombre}`]));
  const rows: MovimientoRow[] = (data ?? []).map((m) => ({
    id: m.id,
    fecha: m.createdAt,
    producto: nombres.get(m.productoId) ?? `#${m.productoId}`,
    tipo: m.tipo,
    cantidad: cantidadConSigno(m),
    costo: m.costoUnitario ?? null,
    usuario: m.usuario ?? '—',
    ordenId: m.ordenId ?? null,
    notas: m.notas ?? '',
  }));

  const columns: Column<MovimientoRow>[] = [
    { key: 'fecha', label: 'Fecha', sortable: true, render: (r) => formatDateTime(r.fecha) },
    { key: 'producto', label: 'Producto', sortable: true },
    {
      key: 'tipo',
      label: 'Tipo',
      sortable: true,
      render: (r) => <Badge variant={TIPO_VARIANT[r.tipo]}>{TIPO_MOVIMIENTO_LABELS[r.tipo]}</Badge>,
    },
    {
      key: 'cantidad',
      label: 'Cantidad',
      sortable: true,
      render: (r) => (
        <span className={r.cantidad < 0 ? 'font-semibold text-red-600' : 'font-semibold text-green-700'}>
          {r.cantidad > 0 ? `+${r.cantidad}` : r.cantidad}
        </span>
      ),
    },
    {
      key: 'costo',
      label: 'Costo',
      sortable: true,
      render: (r) => (r.costo == null ? '—' : formatCurrency(r.costo)),
    },
    { key: 'usuario', label: 'Usuario', sortable: true },
    {
      key: 'ordenId',
      label: 'Orden',
      render: (r) =>
        r.ordenId == null ? (
          '—'
        ) : (
          <Link className="text-blue-600 hover:underline" to={`/reparaciones/${r.ordenId}`}>
            Orden #{r.ordenId}
          </Link>
        ),
    },
    { key: 'notas', label: 'Notas' },
  ];

  const hayFiltros = Boolean(filtro.productoId || filtro.tipo || filtro.desde || filtro.hasta);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <FormField label="Producto">
          <Select
            aria-label="Filtrar por producto"
            options={productos.map((p) => ({ value: String(p.id), label: `${p.codigo} · ${p.nombre}` }))}
            placeholder="Todos los productos"
            value={filtro.productoId != null ? String(filtro.productoId) : ''}
            onChange={(e) =>
              onFiltroChange({ ...filtro, productoId: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </FormField>
        <FormField label="Tipo">
          <Select
            aria-label="Filtrar por tipo"
            options={TIPO_FILTER_OPTIONS}
            placeholder="Todos los tipos"
            value={filtro.tipo ?? ''}
            onChange={(e) =>
              onFiltroChange({ ...filtro, tipo: (e.target.value || undefined) as TipoMovimiento | undefined })
            }
          />
        </FormField>
        <FormField label="Desde">
          <Input
            aria-label="Desde"
            type="date"
            value={filtro.desde ?? ''}
            onChange={(e) => onFiltroChange({ ...filtro, desde: e.target.value || undefined })}
          />
        </FormField>
        <FormField label="Hasta">
          <Input
            aria-label="Hasta"
            type="date"
            value={filtro.hasta ?? ''}
            onChange={(e) => onFiltroChange({ ...filtro, hasta: e.target.value || undefined })}
          />
        </FormField>
        {hayFiltros && (
          <Button variant="secondary" onClick={() => onFiltroChange({})}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {error ? (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar movimientos: {error instanceof Error ? error.message : String(error)}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : (
        <DataTable<MovimientoRow>
          columns={columns}
          data={rows}
          loading={isPending}
          emptyMessage="No hay movimientos para los filtros elegidos"
          keyExtractor={(r) => r.id}
        />
      )}
    </div>
  );
}
