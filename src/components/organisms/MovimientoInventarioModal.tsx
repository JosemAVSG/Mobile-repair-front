import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../atoms/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import { IconActionButton } from '../molecules/IconActionButton';
import { ApiError } from '../../api/ApiClient';
import type {
  CompraRequest,
  MovimientoRequest,
  ProductoInventario,
  SentidoMovimiento,
} from '../../types';
import { TIPO_MOVIMIENTO_LABELS } from '../../utils/formatters';

type TipoDialogo = 'COMPRA' | 'AJUSTE';

interface MovimientoInventarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Producto preseleccionado (acción de fila). Opcional. */
  producto?: ProductoInventario | null;
  productos: ProductoInventario[];
  onSubmitCompra: (body: CompraRequest) => Promise<void>;
  onSubmitAjuste: (body: MovimientoRequest) => Promise<void>;
  loading?: boolean;
}

interface LineaForm {
  key: number;
  productoId: string;
  cantidad: string;
  costoUnitario: string;
}

const TIPO_OPTIONS = [
  { value: 'COMPRA', label: TIPO_MOVIMIENTO_LABELS.COMPRA },
  { value: 'AJUSTE', label: TIPO_MOVIMIENTO_LABELS.AJUSTE },
];

const SENTIDO_OPTIONS = [
  { value: 'ENTRADA', label: 'Suma al stock' },
  { value: 'SALIDA', label: 'Resta del stock' },
];

const TEXTAREA_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500';

let lineaSeq = 0;
const nuevaLinea = (productoId = '', costo = ''): LineaForm => ({
  key: ++lineaSeq,
  productoId,
  cantidad: '',
  costoUnitario: costo,
});

const esEnteroPositivo = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n > 0;
};

/** El backend es la autoridad: se muestra su mensaje (meta.message) si viene en el 400. */
function mensajeDeError(err: unknown): string {
  if (err instanceof ApiError && err.status === 400) {
    const body = err.data as { meta?: { message?: string } } | null;
    if (body?.meta?.message) return body.meta.message;
  }
  return err instanceof Error ? err.message : 'Error al registrar el movimiento';
}

export function MovimientoInventarioModal({
  isOpen,
  onClose,
  producto,
  productos,
  onSubmitCompra,
  onSubmitAjuste,
  loading = false,
}: MovimientoInventarioModalProps) {
  const [tipo, setTipo] = useState<TipoDialogo>('COMPRA');
  const [lineas, setLineas] = useState<LineaForm[]>([nuevaLinea()]);
  const [notas, setNotas] = useState('');
  // Ajuste
  const [ajusteProductoId, setAjusteProductoId] = useState('');
  const [ajusteCantidad, setAjusteCantidad] = useState('');
  const [sentido, setSentido] = useState<SentidoMovimiento | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTipo('COMPRA');
      setLineas([
        producto
          ? nuevaLinea(String(producto.id), String(producto.costoUnitario ?? ''))
          : nuevaLinea(),
      ]);
      setNotas('');
      setAjusteProductoId(producto ? String(producto.id) : '');
      setAjusteCantidad('');
      setSentido('');
      setError(null);
    }
  }, [isOpen, producto]);

  const productoOptions = productos
    .filter((p) => !p.archivado)
    .map((p) => ({
    value: String(p.id),
    label: `${p.codigo} · ${p.nombre}`,
  }));

  const updateLinea = (key: number, patch: Partial<LineaForm>) =>
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const handleProductoLinea = (key: number, productoId: string) => {
    const p = productos.find((x) => String(x.id) === productoId);
    updateLinea(key, {
      productoId,
      costoUnitario: p ? String(p.costoUnitario ?? '') : '',
    });
  };

  const submitCompra = async () => {
    if (lineas.length === 0) return 'Agregá al menos una línea';
    for (const l of lineas) {
      if (!l.productoId) return 'Seleccioná el producto en cada línea';
      if (!esEnteroPositivo(l.cantidad)) return 'Ingresá una cantidad válida (entero > 0) en cada línea';
      const costo = Number(l.costoUnitario);
      if (l.costoUnitario.trim() === '' || Number.isNaN(costo) || costo < 0) {
        return 'Ingresá un costo unitario válido (≥ 0) en cada línea';
      }
    }
    await onSubmitCompra({
      notas: notas.trim() || undefined,
      lineas: lineas.map((l) => ({
        productoId: Number(l.productoId),
        cantidad: Number(l.cantidad),
        costoUnitario: Number(l.costoUnitario),
      })),
    });
    return null;
  };

  const submitAjuste = async () => {
    if (!ajusteProductoId) return 'Seleccioná el producto';
    if (!esEnteroPositivo(ajusteCantidad)) return 'Ingresá una cantidad válida (entero > 0)';
    if (!sentido) return 'Indicá si el ajuste suma o resta';
    if (!notas.trim()) return 'La nota es obligatoria en un ajuste';
    // Solo una ayuda: si el stock local no alcanza se avisa, pero decide el backend.
    const p = productos.find((x) => String(x.id) === ajusteProductoId);
    if (sentido === 'SALIDA' && p && Number(ajusteCantidad) > p.stock) {
      return `Stock insuficiente. Disponible: ${p.stock}`;
    }
    await onSubmitAjuste({
      productoId: Number(ajusteProductoId),
      tipo: 'AJUSTE',
      cantidad: Number(ajusteCantidad),
      sentido,
      notas: notas.trim(),
    });
    return null;
  };

  const handleSubmit = useCallback(async () => {
    setError(null);
    try {
      const problema = tipo === 'COMPRA' ? await submitCompra() : await submitAjuste();
      if (problema) {
        setError(problema);
        return;
      }
      onClose();
    } catch (err: unknown) {
      setError(mensajeDeError(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, lineas, notas, ajusteProductoId, ajusteCantidad, sentido, productos, onSubmitCompra, onSubmitAjuste, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Movimiento"
      size="lg"
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
        <FormField label="Tipo de movimiento" required>
          <Select
            aria-label="Tipo de movimiento"
            options={TIPO_OPTIONS}
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoDialogo);
              setError(null);
            }}
            disabled={loading}
          />
        </FormField>

        {tipo === 'COMPRA' ? (
          <div className="space-y-3">
            {lineas.map((l, i) => (
              <div
                key={l.key}
                className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
              >
                <FormField label={`Producto (línea ${i + 1})`} required>
                  <Select
                    aria-label={`Producto línea ${i + 1}`}
                    options={productoOptions}
                    placeholder="Seleccionar producto..."
                    value={l.productoId}
                    onChange={(e) => handleProductoLinea(l.key, e.target.value)}
                    disabled={loading}
                  />
                </FormField>
                <FormField label="Cantidad" required>
                  <Input
                    aria-label={`Cantidad línea ${i + 1}`}
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Ej: 5"
                    value={l.cantidad}
                    onChange={(e) => updateLinea(l.key, { cantidad: e.target.value })}
                    disabled={loading}
                  />
                </FormField>
                <FormField label="Costo unitario" required>
                  <Input
                    aria-label={`Costo unitario línea ${i + 1}`}
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0"
                    value={l.costoUnitario}
                    onChange={(e) =>
                      updateLinea(l.key, { costoUnitario: e.target.value.replace(',', '.') })
                    }
                    disabled={loading}
                  />
                </FormField>
                {lineas.length > 1 && (
                  <IconActionButton
                    icon="trash"
                    label="Quitar línea"
                    variant="danger"
                    onClick={() => setLineas((prev) => prev.filter((x) => x.key !== l.key))}
                  />
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() => setLineas((prev) => [...prev, nuevaLinea()])}
              disabled={loading}
            >
              Agregar línea
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Producto" required>
                <Select
                  aria-label="Producto"
                  options={productoOptions}
                  placeholder="Seleccionar producto..."
                  value={ajusteProductoId}
                  onChange={(e) => setAjusteProductoId(e.target.value)}
                  disabled={loading}
                />
              </FormField>
            </div>
            <FormField label="Cantidad" required>
              <Input
                aria-label="Cantidad"
                type="number"
                min={1}
                step={1}
                placeholder="Ej: 5"
                value={ajusteCantidad}
                onChange={(e) => setAjusteCantidad(e.target.value)}
                disabled={loading}
              />
            </FormField>
            <FormField label="Sentido" required>
              <Select
                aria-label="Sentido"
                options={SENTIDO_OPTIONS}
                placeholder="Suma o resta..."
                value={sentido}
                onChange={(e) => setSentido(e.target.value as SentidoMovimiento | '')}
                disabled={loading}
              />
            </FormField>
          </div>
        )}

        <FormField
          label={tipo === 'AJUSTE' ? 'Nota (obligatoria)' : 'Notas (opcional)'}
          required={tipo === 'AJUSTE'}
        >
          <textarea
            aria-label={tipo === 'AJUSTE' ? 'Nota' : 'Notas'}
            className={TEXTAREA_CLASS}
            rows={3}
            placeholder={
              tipo === 'AJUSTE' ? 'Motivo del ajuste (ej: conteo físico)...' : 'Proveedor, factura...'
            }
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            disabled={loading}
          />
        </FormField>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
