import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../atoms/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { FormField } from '../molecules/FormField';
import { ApiError } from '../../api/client';
import type { ProductoInventario, ProductoInventarioRequest } from '../../types';

interface ProductoInventarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto?: ProductoInventario | null;
  onSubmit: (body: ProductoInventarioRequest) => Promise<void>;
  loading?: boolean;
}

interface FormErrors {
  codigo?: string;
  nombre?: string;
  stock?: string;
  stockMinimo?: string;
  costoUnitario?: string;
  general?: string;
}

const emptyForm: ProductoInventarioRequest = {
  codigo: '',
  nombre: '',
  descripcion: '',
  stock: 0,
  stockMinimo: 0,
  costoUnitario: 0,
};

export function ProductoInventarioModal({
  isOpen,
  onClose,
  producto,
  onSubmit,
  loading = false,
}: ProductoInventarioModalProps) {
  const isEditing = producto != null;
  const [form, setForm] = useState<ProductoInventarioRequest>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

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
        });
      } else {
        setForm(emptyForm);
      }
      setFieldErrors({});
    }
  }, [isOpen, producto]);

  const setValue = useCallback(
    <K extends keyof ProductoInventarioRequest>(key: K, value: ProductoInventarioRequest[K]) => {
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

    if (form.stock < 0 || !Number.isInteger(form.stock)) {
      errors.stock = 'Ingrese un stock válido (entero ≥ 0)';
    }

    if (form.stockMinimo < 0 || !Number.isInteger(form.stockMinimo)) {
      errors.stockMinimo = 'Ingrese un stock mínimo válido (entero ≥ 0)';
    }

    if (form.costoUnitario < 0 || Number.isNaN(form.costoUnitario)) {
      errors.costoUnitario = 'Ingrese un costo unitario válido (≥ 0)';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    try {
      await onSubmit({
        ...form,
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || undefined,
      });
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
  }, [form, validate, onSubmit, onClose]);

  const handleNumberChange = (
    key: 'stock' | 'stockMinimo' | 'costoUnitario',
    value: string,
  ) => {
    const normalized = value.replace(',', '.');
    const num = normalized === '' ? 0 : Number(normalized);
    setValue(key, num);
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
