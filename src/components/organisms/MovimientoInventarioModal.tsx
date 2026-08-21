import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../atoms/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import { Spinner } from '../atoms/Spinner';
import { Badge } from '../atoms/Badge';
import { ApiError } from '../../api/client';
import { useOrdenes } from '../../hooks/useQueries';
import type {
  MovimientoRequest,
  ProductoInventario,
  TipoMovimiento,
} from '../../types';
import {
  ESTADO_STOCK_LABELS,
  ESTADO_STOCK_VARIANTS,
  TIPO_MOVIMIENTO_LABELS,
  formatCurrency,
} from '../../utils/formatters';

interface MovimientoInventarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoInventario | null;
  onSubmit: (body: MovimientoRequest) => Promise<void>;
  loading?: boolean;
}

interface FormErrors {
  tipo?: string;
  cantidad?: string;
  general?: string;
}

const TIPO_OPTIONS = [
  { value: 'COMPRA', label: TIPO_MOVIMIENTO_LABELS.COMPRA },
  { value: 'CONSUMO', label: TIPO_MOVIMIENTO_LABELS.CONSUMO },
];

export function MovimientoInventarioModal({
  isOpen,
  onClose,
  producto,
  onSubmit,
  loading = false,
}: MovimientoInventarioModalProps) {
  const [tipo, setTipo] = useState<TipoMovimiento>('COMPRA');
  const [cantidad, setCantidad] = useState('');
  const [ordenId, setOrdenId] = useState('');
  const [notas, setNotas] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const { data: ordenes, isPending: loadingOrdenes } = useOrdenes();

  useEffect(() => {
    if (isOpen) {
      setTipo('COMPRA');
      setCantidad('');
      setOrdenId('');
      setNotas('');
      setFieldErrors({});
    }
  }, [isOpen]);

  const ordenOptions = (ordenes ?? []).map((o) => ({
    value: String(o.id),
    label: `Orden #${o.id}`,
  }));

  const validate = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!tipo) {
      errors.tipo = 'Seleccione un tipo de movimiento';
    }

    const cantidadNum = Number(cantidad);
    if (
      cantidad === '' ||
      Number.isNaN(cantidadNum) ||
      !Number.isInteger(cantidadNum) ||
      cantidadNum <= 0
    ) {
      errors.cantidad = 'Ingrese una cantidad válida (entero > 0)';
    } else if (tipo === 'CONSUMO' && producto && cantidadNum > producto.stock) {
      errors.cantidad = `Stock insuficiente. Disponible: ${producto.stock}`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [tipo, cantidad, producto]);

  const handleSubmit = useCallback(async () => {
    if (!producto || !validate()) return;

    try {
      await onSubmit({
        productoId: producto.id,
        tipo,
        cantidad: Number(cantidad),
        ordenId: ordenId ? Number(ordenId) : undefined,
        notas: notas.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : 'Error al registrar el movimiento';

      if (err instanceof ApiError && err.status === 400) {
        const body = err.data as { meta?: { message?: string } } | null;
        if (body?.meta?.message?.toLowerCase().includes('stock')) {
          setFieldErrors((prev) => ({
            ...prev,
            cantidad: body.meta?.message ?? 'Stock insuficiente',
          }));
          return;
        }
        message = body?.meta?.message ?? message;
      }

      setFieldErrors((prev) => ({ ...prev, general: message }));
    }
  }, [producto, tipo, cantidad, ordenId, notas, validate, onSubmit, onClose]);

  if (!producto) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Movimiento"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Registrar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">{producto.nombre}</p>
          <p className="text-xs text-slate-500">{producto.codigo}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <span>
              Stock: <strong>{producto.stock}</strong>
            </span>
            <span>
              Mín: <strong>{producto.stockMinimo}</strong>
            </span>
            <Badge variant={ESTADO_STOCK_VARIANTS[producto.estado]}>
              {ESTADO_STOCK_LABELS[producto.estado]}
            </Badge>
            <span className="text-slate-500">{formatCurrency(producto.costoUnitario)}</span>
          </div>
        </div>

        <FormField label="Tipo de movimiento" required error={fieldErrors.tipo}>
          <Select
            options={TIPO_OPTIONS}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMovimiento)}
            disabled={loading}
          />
        </FormField>

        <FormField label="Cantidad" required error={fieldErrors.cantidad}>
          <Input
            type="number"
            min={1}
            step={1}
            placeholder="Ej: 5"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            disabled={loading}
          />
        </FormField>

        <FormField label="Orden de trabajo (opcional)">
          {loadingOrdenes ? (
            <div className="flex h-10 items-center gap-2 text-sm text-slate-500">
              <Spinner size="sm" />
              Cargando órdenes...
            </div>
          ) : (
            <Select
              options={ordenOptions}
              placeholder="Seleccionar orden (opcional)..."
              value={ordenId}
              onChange={(e) => setOrdenId(e.target.value)}
              disabled={loading}
            />
          )}
        </FormField>

        <FormField label="Notas (opcional)">
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500"
            rows={3}
            placeholder="Notas adicionales..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            disabled={loading}
          />
        </FormField>

        {fieldErrors.general && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {fieldErrors.general}
          </p>
        )}
      </div>
    </Modal>
  );
}
