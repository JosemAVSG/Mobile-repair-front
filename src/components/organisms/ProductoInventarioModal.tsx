import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../atoms/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import { ModelosCompatiblesSelect } from '../molecules/ModelosCompatiblesSelect';
import { useMarcas, useModelos } from '../../hooks/useQueries';
import { getModeloIds, sameIdSet } from '../../utils/maps';
import { ApiError } from '../../api/ApiClient';
import { TIPO_REPARACION_LABELS } from '../../utils/formatters';
import { TipoReparacion } from '../../types';
import type {
  ProductoInventario,
  ProductoInventarioRequest,
  UsoProducto,
} from '../../types';

interface ProductoInventarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto?: ProductoInventario | null;
  /** El plan incluye ventas e inventario. Sin él solo se pueden crear repuestos. Default: true. */
  inventarioHabilitado?: boolean;
  onSubmit: (body: ProductoInventarioRequest) => Promise<void>;
  loading?: boolean;
}

interface FormErrors {
  codigo?: string;
  nombre?: string;
  stock?: string;
  stockMinimo?: string;
  costoUnitario?: string;
  precioVenta?: string;
  general?: string;
}

/**
 * Estado del form. `precioVenta` se maneja como string para distinguir "vacío" de 0: un precio
 * de venta de 0 es sospechoso y debe disparar validación, no guardarse en silencio.
 */
interface ProductoFormState {
  codigo: string;
  nombre: string;
  descripcion: string;
  stock: number;
  stockMinimo: number;
  costoUnitario: number;
  precioVenta: string;
  uso: UsoProducto;
  controlaStock: boolean;
  marcaId: string;
  tipoReparacion: string;
  categoria: string;
  variante: string;
  proveedor: string;
  modeloIds: number[];
}

const TIPO_REPARACION_OPTIONS = Object.values(TipoReparacion).map((t) => ({
  value: t,
  label: TIPO_REPARACION_LABELS[t],
}));

export const REQUIERE_PLAN_HINT = 'Requiere el plan con ventas e inventario';

const usaPrecioVenta = (uso: UsoProducto) => uso === 'VENTA' || uso === 'AMBOS';
const usaRepuesto = (uso: UsoProducto) => uso === 'REPUESTO' || uso === 'AMBOS';

const emptyForm: ProductoFormState = {
  codigo: '',
  nombre: '',
  descripcion: '',
  stock: 0,
  stockMinimo: 0,
  costoUnitario: 0,
  precioVenta: '',
  uso: 'VENTA',
  controlaStock: true,
  marcaId: '',
  tipoReparacion: '',
  categoria: '',
  variante: '',
  proveedor: '',
  modeloIds: [],
};

export function ProductoInventarioModal({
  isOpen,
  onClose,
  producto,
  inventarioHabilitado = true,
  onSubmit,
  loading = false,
}: ProductoInventarioModalProps) {
  const isEditing = producto != null;
  const [form, setForm] = useState<ProductoFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const marcasReq = useMarcas();
  const modelosReq = useModelos();

  useEffect(() => {
    if (isOpen) {
      if (producto) {
        setForm({
          codigo: producto.codigo,
          nombre: producto.nombre,
          descripcion: producto.descripcion ?? '',
          stock: producto.stock,
          stockMinimo: producto.stockMinimo,
          costoUnitario: producto.costoUnitario,
          precioVenta:
            producto.precioVenta != null ? String(producto.precioVenta) : '',
          uso: producto.uso ?? 'VENTA',
          controlaStock: producto.controlaStock ?? true,
          marcaId: producto.marcaId != null ? String(producto.marcaId) : '',
          tipoReparacion: producto.tipoReparacion ?? '',
          categoria: producto.categoria ?? '',
          variante: producto.variante ?? '',
          proveedor: producto.proveedor ?? '',
          modeloIds: getModeloIds(producto),
        });
      } else {
        setForm(
          inventarioHabilitado
            ? emptyForm
            : { ...emptyForm, uso: 'REPUESTO', controlaStock: false },
        );
      }
      setFieldErrors({});
    }
  }, [isOpen, producto, inventarioHabilitado]);

  const setValue = useCallback(
    <K extends keyof ProductoFormState>(key: K, value: ProductoFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const validate = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!form.codigo.trim()) {
      errors.codigo = 'El código es obligatorio';
    }

    if (!form.nombre.trim()) {
      errors.nombre = 'El nombre es obligatorio';
    }

    if (inventarioHabilitado && form.controlaStock) {
      if (form.stock < 0 || !Number.isInteger(form.stock)) {
        errors.stock = 'Ingrese un stock válido (entero ≥ 0)';
      }

      if (form.stockMinimo < 0 || !Number.isInteger(form.stockMinimo)) {
        errors.stockMinimo = 'Ingrese un stock mínimo válido (entero ≥ 0)';
      }
    }

    if (form.costoUnitario < 0 || Number.isNaN(form.costoUnitario)) {
      errors.costoUnitario = 'Ingrese un costo unitario válido (≥ 0)';
    }

    const precioVentaNum = Number(form.precioVenta);
    if (usaPrecioVenta(form.uso)) {
      if (form.precioVenta.trim() === '' || Number.isNaN(precioVentaNum) || precioVentaNum <= 0) {
        errors.precioVenta = 'Ingrese un precio de venta mayor a 0';
      }
    } else if (
      form.precioVenta.trim() !== '' &&
      (Number.isNaN(precioVentaNum) || precioVentaNum < 0)
    ) {
      errors.precioVenta = 'Ingrese un precio de venta válido (≥ 0)';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, inventarioHabilitado]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    try {
      const {
        modeloIds,
        precioVenta,
        marcaId,
        tipoReparacion,
        stock,
        stockMinimo,
      } = form;
      const esRepuesto = usaRepuesto(form.uso);
      const body: ProductoInventarioRequest = {
        uso: form.uso,
        controlaStock: form.controlaStock,
        costoUnitario: form.costoUnitario,
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || undefined,
        ...(precioVenta.trim() !== '' ? { precioVenta: Number(precioVenta) } : {}),
      };

      if (!isEditing || !producto) {
        // Alta: se envían defaults de stock y solo los opcionales completados.
        body.stock = stock;
        body.stockMinimo = stockMinimo;
        for (const key of ['categoria', 'variante', 'proveedor'] as const) {
          const value = form[key].trim();
          if (value) body[key] = value;
        }
        if (esRepuesto) {
          if (marcaId) body.marcaId = Number(marcaId);
          if (tipoReparacion) body.tipoReparacion = tipoReparacion as TipoReparacion;
          if (modeloIds.length > 0) body.modeloIds = modeloIds;
        }
      } else {
        // Edición (PATCH): cada opcional viaja solo si cambió; vaciarlo envía la representación
        // explícita de limpiar ('' para strings, limpiarX para marca/tipo).
        const stockVisible = inventarioHabilitado && form.controlaStock;
        if (stockVisible && stock !== producto.stock) body.stock = stock;
        if (stockVisible && stockMinimo !== producto.stockMinimo) body.stockMinimo = stockMinimo;

        const strings = ['categoria', 'variante', 'proveedor'] as const;
        for (const key of strings) {
          const next = form[key].trim();
          if (next !== (producto[key] ?? '').trim()) body[key] = next;
        }

        const prevMarca = producto.marcaId != null ? String(producto.marcaId) : '';
        const prevTipo = producto.tipoReparacion ?? '';
        const prevModelos = getModeloIds(producto);
        if (esRepuesto) {
          if (marcaId !== prevMarca) {
            if (marcaId) body.marcaId = Number(marcaId);
            else body.limpiarMarca = true;
          }
          if (tipoReparacion !== prevTipo) {
            if (tipoReparacion) body.tipoReparacion = tipoReparacion as TipoReparacion;
            else body.limpiarTipoReparacion = true;
          }
          if (!sameIdSet(modeloIds, prevModelos)) body.modeloIds = modeloIds;
        } else {
          // Convertido a VENTA: los campos de repuesto se limpian si había algo cargado.
          if (prevMarca) body.limpiarMarca = true;
          if (prevTipo) body.limpiarTipoReparacion = true;
          if (prevModelos.length > 0) body.modeloIds = [];
        }
      }
      await onSubmit(body);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldErrors((prev) => ({
          ...prev,
          codigo: 'Ya existe un producto con este código',
        }));
        return;
      }

      const message =
        err instanceof Error ? err.message : 'Error al guardar el producto';
      setFieldErrors((prev) => ({ ...prev, general: message }));
    }
  }, [form, validate, onSubmit, onClose, isEditing, producto, inventarioHabilitado]);

  const handleNumberChange = (
    key: 'stock' | 'stockMinimo' | 'costoUnitario',
    value: string,
  ) => {
    const normalized = value.replace(',', '.');
    const num = normalized === '' ? 0 : Number(normalized);
    setValue(key, num);
  };

  // El precio de venta conserva el string crudo: vacío debe seguir siendo vacío para que la
  // validación lo detecte, en vez de convertirse en 0 silenciosamente.
  const handlePrecioVentaChange = (value: string) => {
    setValue('precioVenta', value.replace(',', '.'));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Producto' : 'Nuevo Producto'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {isEditing ? 'Actualizar' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Código" required error={fieldErrors.codigo}>
          <Input
            placeholder="Ej: BAT-IP13"
            value={form.codigo}
            onChange={(e) => setValue('codigo', e.target.value)}
            disabled={loading}
          />
        </FormField>

        <FormField label="Nombre" required error={fieldErrors.nombre}>
          <Input
            placeholder="Ej: Batería iPhone 13"
            value={form.nombre}
            onChange={(e) => setValue('nombre', e.target.value)}
            disabled={loading}
          />
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="Descripción">
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              placeholder="Descripción del producto (opcional)..."
              value={form.descripcion}
              onChange={(e) => setValue('descripcion', e.target.value)}
              disabled={loading}
            />
          </FormField>
        </div>

        <div className="sm:col-span-2">
          <FormField label="Uso">
            <select
              aria-label="Uso"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500"
              value={form.uso}
              onChange={(e) => {
                const uso = e.target.value as UsoProducto;
                setForm((prev) => ({
                  ...prev,
                  uso,
                  // Default sugerido por uso solo en el alta; al editar se respeta el valor actual.
                  controlaStock: isEditing ? prev.controlaStock : uso !== 'REPUESTO',
                }));
              }}
              disabled={loading}
            >
              <option value="VENTA" disabled={!inventarioHabilitado}>
                Venta
              </option>
              <option value="REPUESTO">Repuesto</option>
              <option value="AMBOS" disabled={!inventarioHabilitado}>
                Ambos
              </option>
            </select>
            <p className="text-xs text-slate-500">
              {inventarioHabilitado
                ? 'Venta = solo se vende. Repuesto = se usa en reparaciones. Ambos = las dos cosas.'
                : `Solo repuestos. Venta y Ambos: ${REQUIERE_PLAN_HINT}.`}
            </p>
          </FormField>
        </div>

        <FormField label="Costo unitario" required error={fieldErrors.costoUnitario}>
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="0"
            value={form.costoUnitario}
            onChange={(e) => handleNumberChange('costoUnitario', e.target.value)}
            disabled={loading}
          />
        </FormField>

        <FormField
          label="Precio de venta"
          required={usaPrecioVenta(form.uso)}
          error={fieldErrors.precioVenta}
        >
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="0"
            value={form.precioVenta}
            onChange={(e) => handlePrecioVentaChange(e.target.value)}
            disabled={loading}
          />
        </FormField>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.controlaStock}
              onChange={(e) => setValue('controlaStock', e.target.checked)}
              // Sin plan solo se puede apagar el control, no encenderlo.
              disabled={loading || (!inventarioHabilitado && !form.controlaStock)}
            />
            Controlar stock
          </label>
          {!inventarioHabilitado && (
            <p className="text-xs text-slate-500">
              Sin el plan completo solo se puede apagar el control de stock.
            </p>
          )}
        </div>

        {inventarioHabilitado && form.controlaStock && (
          <>
            <FormField label="Stock" required error={fieldErrors.stock}>
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={form.stock}
                onChange={(e) => handleNumberChange('stock', e.target.value)}
                disabled={loading}
              />
            </FormField>

            <FormField label="Stock mínimo" required error={fieldErrors.stockMinimo}>
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={form.stockMinimo}
                onChange={(e) => handleNumberChange('stockMinimo', e.target.value)}
                disabled={loading}
              />
            </FormField>
          </>
        )}

        <FormField label="Categoría">
          <Input
            value={form.categoria}
            onChange={(e) => setValue('categoria', e.target.value)}
            disabled={loading}
          />
        </FormField>

        <FormField label="Variante">
          <Input
            value={form.variante}
            onChange={(e) => setValue('variante', e.target.value)}
            disabled={loading}
          />
        </FormField>

        <FormField label="Proveedor">
          <Input
            value={form.proveedor}
            onChange={(e) => setValue('proveedor', e.target.value)}
            disabled={loading}
          />
        </FormField>

        {usaRepuesto(form.uso) && (
          <>
            <FormField label="Marca">
              <Select
                aria-label="Marca"
                options={(marcasReq.data ?? []).map((m) => ({
                  value: String(m.id),
                  label: m.nombre,
                }))}
                placeholder="Sin marca"
                value={form.marcaId}
                onChange={(e) => setValue('marcaId', e.target.value)}
                disabled={loading}
              />
            </FormField>

            <FormField label="Tipo de reparación">
              <Select
                aria-label="Tipo de reparación"
                options={TIPO_REPARACION_OPTIONS}
                placeholder="Sin tipo"
                value={form.tipoReparacion}
                onChange={(e) => setValue('tipoReparacion', e.target.value)}
                disabled={loading}
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Modelos compatibles">
                <ModelosCompatiblesSelect
                  modelos={modelosReq.data ?? []}
                  marcas={marcasReq.data ?? []}
                  value={form.modeloIds}
                  onChange={(ids) => setValue('modeloIds', ids)}
                  disabled={loading}
                />
              </FormField>
            </div>
          </>
        )}

        {fieldErrors.general && (
          <div className="sm:col-span-2">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {fieldErrors.general}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
