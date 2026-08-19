import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { apiPost, apiPut, apiDelete } from '../api/client';
import { formatCurrency } from '../utils/formatters';
import type { Repuesto, RepuestoRequest } from '../types';
import { useRepuestos, useRepuestosBajoStock } from '../hooks/useQueries';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface RepuestoRow {
  id: number;
  codigo: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  precioCosto: number;
  precioVenta: number;
  bajoStock: boolean;
}

interface FormErrors {
  nombre?: string;
  codigo?: string;
  precioCosto?: string;
  precioVenta?: string;
  stockActual?: string;
  stockMinimo?: string;
}

// ──────────────────────────────────────────────
// RepuestosPage
// ──────────────────────────────────────────────

export function RepuestosPage() {
  // ───── Filter state ─────
  const [bajoStockOnly, setBajoStockOnly] = useState(false);

  // ───── Data fetching ─────
  const queryClient = useQueryClient();

  const repuestosAll = useRepuestos();
  const repuestosBajoStock = useRepuestosBajoStock();

  const {
    data: repuestos,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = bajoStockOnly ? repuestosBajoStock : repuestosAll;

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const saveMutation = useMutation({
    mutationFn: (body: RepuestoRequest) =>
      editingRepuesto
        ? apiPut<Repuesto>(`/api/repuestos/${editingRepuesto.id}`, body)
        : apiPost<Repuesto>('/api/repuestos', body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['repuestos'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete<unknown>(`/api/repuestos/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['repuestos'] }),
  });

  // ───── Create/Edit modal state ─────
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRepuesto, setEditingRepuesto] = useState<Repuesto | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editCodigo, setEditCodigo] = useState('');
  const [editPrecioCosto, setEditPrecioCosto] = useState('');
  const [editPrecioVenta, setEditPrecioVenta] = useState('');
  const [editStockActual, setEditStockActual] = useState('');
  const [editStockMinimo, setEditStockMinimo] = useState('');
  const [editProveedorId, setEditProveedorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  // ───── Delete state ─────
  const [deleteTarget, setDeleteTarget] = useState<Repuesto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ───── Validation ─────

  const validate = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (!editNombre.trim()) errors.nombre = 'El nombre es obligatorio';
    if (!editCodigo.trim()) errors.codigo = 'El código es obligatorio';
    if (!editPrecioCosto || isNaN(Number(editPrecioCosto)) || Number(editPrecioCosto) < 0) {
      errors.precioCosto = 'Ingrese un precio de costo válido';
    }
    if (!editPrecioVenta || isNaN(Number(editPrecioVenta)) || Number(editPrecioVenta) < 0) {
      errors.precioVenta = 'Ingrese un precio de venta válido';
    }
    if (!editStockActual || isNaN(Number(editStockActual)) || !Number.isInteger(Number(editStockActual)) || Number(editStockActual) < 0) {
      errors.stockActual = 'Ingrese un stock actual válido';
    }
    if (!editStockMinimo || isNaN(Number(editStockMinimo)) || !Number.isInteger(Number(editStockMinimo)) || Number(editStockMinimo) < 0) {
      errors.stockMinimo = 'Ingrese un stock mínimo válido';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editNombre, editCodigo, editPrecioCosto, editPrecioVenta, editStockActual, editStockMinimo]);

  // ───── Create / Update ─────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const body: RepuestoRequest = {
        nombre: editNombre.trim(),
        descripcion: editDescripcion.trim() || undefined,
        codigo: editCodigo.trim(),
        precioCosto: Number(editPrecioCosto),
        precioVenta: Number(editPrecioVenta),
        stockActual: Number(editStockActual),
        stockMinimo: Number(editStockMinimo),
        proveedorId: editProveedorId ? Number(editProveedorId) : undefined,
      };

      if (editingRepuesto) {
        await apiPut(`/api/repuestos/${editingRepuesto.id}`, body);
      } else {
        await apiPost<Repuesto>('/api/repuestos', body);
      }

      setCreateOpen(false);
      setEditingRepuesto(null);
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar repuesto';
      setFieldErrors({ nombre: msg });
    } finally {
      setSubmitting(false);
    }
  }, [
    editNombre, editDescripcion, editCodigo,
    editPrecioCosto, editPrecioVenta,
    editStockActual, editStockMinimo, editProveedorId,
    editingRepuesto, validate, saveMutation,
  ]);

  // ───── Delete ─────

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      alert(msg);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteMutation]);

  // ───── Helpers ─────

  const resetForm = useCallback(() => {
    setEditNombre('');
    setEditDescripcion('');
    setEditCodigo('');
    setEditPrecioCosto('');
    setEditPrecioVenta('');
    setEditStockActual('');
    setEditStockMinimo('');
    setEditProveedorId('');
    setFieldErrors({});
  }, []);

  const openCreate = useCallback(() => {
    setEditingRepuesto(null);
    resetForm();
    setCreateOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((repuesto: Repuesto) => {
    setEditingRepuesto(repuesto);
    setEditNombre(repuesto.nombre);
    setEditDescripcion(repuesto.descripcion ?? '');
    setEditCodigo(repuesto.codigo);
    setEditPrecioCosto(String(repuesto.precioCosto));
    setEditPrecioVenta(String(repuesto.precioVenta));
    setEditStockActual(String(repuesto.stockActual));
    setEditStockMinimo(String(repuesto.stockMinimo));
    setEditProveedorId(repuesto.proveedorId ? String(repuesto.proveedorId) : '');
    setFieldErrors({});
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setEditingRepuesto(null);
    resetForm();
  }, [resetForm]);

  const toggleBajoStock = useCallback(() => {
    setBajoStockOnly((prev) => !prev);
  }, []);

  // ───── Columns ─────

  const columns: Column<RepuestoRow>[] = [
    { key: 'codigo', label: 'Código', sortable: true },
    { key: 'nombre', label: 'Nombre', sortable: true },
    {
      key: 'stockActual',
      label: 'Stock Actual',
      sortable: true,
      render: (row) => (
        <span
          className={`font-medium ${
            row.stockActual <= row.stockMinimo
              ? 'text-red-600'
              : 'text-slate-700'
          }`}
        >
          {row.stockActual}
        </span>
      ),
    },
    {
      key: 'stockMinimo',
      label: 'Stock Mínimo',
      sortable: true,
      render: (row) => (
        <span
          className={`font-medium ${
            row.stockActual <= row.stockMinimo
              ? 'text-red-600'
              : 'text-slate-700'
          }`}
        >
          {row.stockMinimo}
        </span>
      ),
    },
    {
      key: 'precioCosto',
      label: 'Precio Costo',
      sortable: true,
      render: (row) => formatCurrency(row.precioCosto),
    },
    {
      key: 'precioVenta',
      label: 'Precio Venta',
      sortable: true,
      render: (row) => formatCurrency(row.precioVenta),
    },
    {
      key: 'bajoStock',
      label: 'Estado',
      sortable: true,
      render: (row) => (
        <Badge variant={row.bajoStock ? 'danger' : 'success'}>
          {row.bajoStock ? 'Stock Bajo' : 'OK'}
        </Badge>
      ),
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (row) => {
        const repuesto = (repuestos ?? []).find((r) => r.id === row.id);
        if (!repuesto) return null;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                openEdit(repuesto);
              }}
            >
              Editar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setDeleteTarget(repuesto);
              }}
            >
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  // ───── Row styling for low stock ─────

  const getRowClassName = useCallback((row: RepuestoRow): string => {
    return row.bajoStock ? 'border-l-2 border-l-red-500 bg-red-50/30' : '';
  }, []);

  // Enriched rows (passthrough since Repuesto maps directly)
  const rows = useMemo<RepuestoRow[]>(() => {
    return (repuestos ?? []).map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      stockActual: r.stockActual,
      stockMinimo: r.stockMinimo,
      precioCosto: r.precioCosto,
      precioVenta: r.precioVenta,
      bajoStock: r.bajoStock,
    }));
  }, [repuestos]);

  // ───── Render ─────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Repuestos</h2>
          <p className="text-sm text-slate-500">
            Gestión de inventario de repuestos
          </p>
        </div>
        <Button onClick={openCreate}>
          Nuevo Repuesto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-4">
        <Button
          variant={bajoStockOnly ? 'primary' : 'secondary'}
          size="sm"
          onClick={toggleBajoStock}
        >
          {bajoStockOnly ? 'Mostrar Todos' : 'Mostrar solo bajo stock'}
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar repuestos: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Data table */}
      {!error && (
        <DataTable<RepuestoRow>
          columns={columns}
          data={rows}
          loading={loading}
          emptyMessage={
            bajoStockOnly
              ? 'No hay repuestos con stock bajo'
              : 'No hay repuestos registrados'
          }
          keyExtractor={(row) => row.id}
          getRowClassName={getRowClassName}
        />
      )}

      {/* ───── Create / Edit Modal ───── */}
      <Modal
        isOpen={createOpen}
        onClose={closeCreate}
        title={editingRepuesto ? 'Editar Repuesto' : 'Nuevo Repuesto'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeCreate} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              {editingRepuesto ? 'Actualizar' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nombre" required error={fieldErrors.nombre}>
            <Input
              placeholder="Ej: Batería iPhone 13"
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
            />
          </FormField>

          <FormField label="Código" required error={fieldErrors.codigo}>
            <Input
              placeholder="Ej: BAT-IP13"
              value={editCodigo}
              onChange={(e) => setEditCodigo(e.target.value)}
            />
          </FormField>

          <div className="sm:col-span-2">
            <FormField label="Descripción">
              <textarea
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500"
                rows={3}
                placeholder="Descripción del repuesto (opcional)..."
                value={editDescripcion}
                onChange={(e) => setEditDescripcion(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Precio Costo" required error={fieldErrors.precioCosto}>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej: 15000"
              value={editPrecioCosto}
              onChange={(e) => setEditPrecioCosto(e.target.value)}
            />
          </FormField>

          <FormField label="Precio Venta" required error={fieldErrors.precioVenta}>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej: 29990"
              value={editPrecioVenta}
              onChange={(e) => setEditPrecioVenta(e.target.value)}
            />
          </FormField>

          <FormField label="Stock Actual" required error={fieldErrors.stockActual}>
            <Input
              type="number"
              step="1"
              min="0"
              placeholder="Ej: 10"
              value={editStockActual}
              onChange={(e) => setEditStockActual(e.target.value)}
            />
          </FormField>

          <FormField label="Stock Mínimo" required error={fieldErrors.stockMinimo}>
            <Input
              type="number"
              step="1"
              min="0"
              placeholder="Ej: 3"
              value={editStockMinimo}
              onChange={(e) => setEditStockMinimo(e.target.value)}
            />
          </FormField>

          <FormField label="Proveedor ID">
            <Input
              type="number"
              step="1"
              min="0"
              placeholder="ID del proveedor (opcional)..."
              value={editProveedorId}
              onChange={(e) => setEditProveedorId(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar Repuesto"
        message={`¿Estás seguro de eliminar el repuesto "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
