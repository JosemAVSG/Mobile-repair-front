import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { IconActionButton } from '../components/molecules/IconActionButton';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { ModelosCompatiblesSelect } from '../components/molecules/ModelosCompatiblesSelect';
import { SearchField } from '../components/molecules/SearchField';
import { type Column } from '../components/organisms/DataTable';
import { EntityList } from '../components/organisms/EntityList';
import { createRepuesto, deleteRepuesto, updateRepuesto } from '../api/repuestos';
import { ApiError } from '../api/ApiClient';
import { formatCurrency, TIPO_REPARACION_LABELS } from '../utils/formatters';
import { buildMarcaMap, buildModeloMap, getModeloIds, sameIdSet } from '../utils/maps';
import type { Repuesto, RepuestoRequest } from '../types';
import { TipoReparacion } from '../types';
import { useRepuestos, useMarcas, useModelos } from '../hooks/useQueries';
import { useToast } from '../context/ToastContext';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const TIPO_REPARACION_OPTIONS = Object.values(TipoReparacion).map((t) => ({
  value: t,
  label: TIPO_REPARACION_LABELS[t],
}));

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface RepuestoRow {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precioCosto: number;
  precioVenta: number | null;
  marcaNombre: string;
  modeloNombre: string;
  tipoReparacion: TipoReparacion;
}

interface FormErrors {
  nombre?: string;
  codigo?: string;
  precioCosto?: string;
  precioVenta?: string;
  tipoReparacion?: string;
}

// ──────────────────────────────────────────────
// RepuestosPage
// ──────────────────────────────────────────────

export function RepuestosPage() {
  const { showToast } = useToast();

  // ───── Filter state ─────
  const [busqueda, setBusqueda] = useState('');

  // ───── Data fetching ─────
  const queryClient = useQueryClient();

  const {
    data: repuestos,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useRepuestos(busqueda || undefined);

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const marcasReq = useMarcas();
  const modelosReq = useModelos();

  const marcaMap = useMemo(() => buildMarcaMap(marcasReq.data ?? []), [marcasReq.data]);
  const modeloMap = useMemo(() => buildModeloMap(modelosReq.data ?? []), [modelosReq.data]);

  const saveMutation = useMutation({
    mutationFn: (body: RepuestoRequest) =>
      editingRepuesto
        ? updateRepuesto(editingRepuesto.id, body)
        : createRepuesto(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['repuestos'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRepuesto(id),
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
  const [editMarcaId, setEditMarcaId] = useState('');
  const [editModeloIds, setEditModeloIds] = useState<number[]>([]);
  const [editTipo, setEditTipo] = useState('');
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
    if (
      editPrecioVenta.trim() !== '' &&
      (isNaN(Number(editPrecioVenta)) || Number(editPrecioVenta) < 0)
    ) {
      errors.precioVenta = 'Ingrese un precio de venta válido';
    }
    if (!editTipo) errors.tipoReparacion = 'Seleccione un tipo de reparación';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editNombre, editCodigo, editPrecioCosto, editPrecioVenta, editTipo]);

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
        precioVenta: editPrecioVenta.trim() === '' ? null : Number(editPrecioVenta),
        marcaId: editMarcaId ? Number(editMarcaId) : undefined,
        tipoReparacion: editTipo as TipoReparacion,
      };

      // Siempre se envía al crear; al editar solo si el usuario cambió la selección.
      const modelosChanged =
        !editingRepuesto || !sameIdSet(editModeloIds, getModeloIds(editingRepuesto));
      if (modelosChanged) {
        body.modeloId = editModeloIds.length ? Math.min(...editModeloIds) : undefined;
        body.modeloIds = editModeloIds;
      }

      if (editingRepuesto) {
        await updateRepuesto(editingRepuesto.id, body);
      } else {
        await createRepuesto(body);
      }

      setCreateOpen(false);
      setEditingRepuesto(null);
      resetForm();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        // El backend devuelve 409 cuando el código de repuesto ya existe en el taller.
        setFieldErrors({ codigo: err.message });
      } else {
        const msg = err instanceof Error ? err.message : 'Error al guardar repuesto';
        setFieldErrors({ nombre: msg });
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    editNombre, editDescripcion, editCodigo,
    editPrecioCosto, editPrecioVenta, editMarcaId, editModeloIds, editTipo,
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
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteMutation, showToast]);

  // ───── Helpers ─────

  const resetForm = useCallback(() => {
    setEditNombre('');
    setEditDescripcion('');
    setEditCodigo('');
    setEditPrecioCosto('');
    setEditPrecioVenta('');
    setEditMarcaId('');
    setEditModeloIds([]);
    setEditTipo('');
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
    setEditPrecioVenta(repuesto.precioVenta != null ? String(repuesto.precioVenta) : '');
    setEditMarcaId(repuesto.marcaId != null ? String(repuesto.marcaId) : '');
    setEditModeloIds(getModeloIds(repuesto));
    setEditTipo(repuesto.tipoReparacion);
    setFieldErrors({});
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setEditingRepuesto(null);
    resetForm();
  }, [resetForm]);

  // ───── Columns ─────

  const columns: Column<RepuestoRow>[] = [
    { key: 'codigo', label: 'Código', sortable: true },
    { key: 'nombre', label: 'Nombre', sortable: true },
    {
      key: 'precioCosto',
      label: 'Costo',
      sortable: true,
      render: (row) => formatCurrency(row.precioCosto),
    },
    {
      key: 'precioVenta',
      label: 'Precio venta',
      sortable: true,
      render: (row) =>
        row.precioVenta != null ? formatCurrency(row.precioVenta) : '—',
    },
    {
      key: 'marcaNombre',
      label: 'Marca',
      sortable: true,
      render: (row) => row.marcaNombre,
    },
    {
      key: 'modeloNombre',
      label: 'Modelos',
      sortable: true,
      render: (row) => row.modeloNombre,
    },
    {
      key: 'tipoReparacion',
      label: 'Tipo Reparación',
      sortable: true,
      render: (row) => (
        <Badge variant="info">
          {TIPO_REPARACION_LABELS[row.tipoReparacion] ?? row.tipoReparacion}
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
            <IconActionButton
 icon="edit"
 label="Editar"
 onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                openEdit(repuesto);
              }}
/>
            <IconActionButton
 icon="trash"
 label="Eliminar"
 variant="danger"
 onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setDeleteTarget(repuesto);
              }}
/>
          </div>
        );
      },
    },
  ];

  // Enriched rows
  const rows = useMemo<RepuestoRow[]>(() => {
    return (repuestos ?? []).map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      precioCosto: r.precioCosto,
      precioVenta: r.precioVenta ?? null,
      marcaNombre:
        r.marcaId != null ? (marcaMap.get(r.marcaId) ?? `Marca #${r.marcaId}`) : '—',
      modeloNombre:
        getModeloIds(r)
          .map((id) => modeloMap.get(id) ?? `Modelo #${id}`)
          .join(', ') || '—',
      tipoReparacion: r.tipoReparacion,
    }));
  }, [repuestos, marcaMap, modeloMap]);

  // ───── Render ─────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Repuestos</h2>
          <p className="text-sm text-slate-500">
            Gestión de repuestos
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="w-full sm:w-64">
            <SearchField
              placeholder="Buscar por nombre..."
              value={busqueda}
              onChange={setBusqueda}
            />
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            Nuevo Repuesto
          </Button>
        </div>
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

      {/* Lista: cards en mobile, toggle Lista/Grilla en desktop */}
      {!error && (
        <EntityList<RepuestoRow>
          columns={columns}
          data={rows}
          loading={loading}
          searchFilter={busqueda}
          emptyMessage="No hay repuestos registrados"
          keyExtractor={(row) => row.id}
          storageKey="vista-repuestos"
          renderCard={(row) => {
            const repuesto = (repuestos ?? []).find((r) => r.id === row.id);
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {row.nombre}
                  </p>
                  <Badge variant="info">
                    {TIPO_REPARACION_LABELS[row.tipoReparacion] ??
                      row.tipoReparacion}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {row.codigo}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">
                      {formatCurrency(row.precioCosto)}
                    </span>
                    {row.precioVenta != null && (
                      <span className="text-xs text-slate-500">
                        Venta: {formatCurrency(row.precioVenta)}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-slate-500">
                    {[row.marcaNombre, row.modeloNombre]
                      .filter((v) => v && v !== '—')
                      .join(' · ') || '—'}
                  </span>
                </div>
                {repuesto && (
                  <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                    <IconActionButton
 icon="edit"
 label="Editar"
 size="lg"
 onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        openEdit(repuesto);
                      }}
/>
                    <IconActionButton
 icon="trash"
 label="Eliminar"
 variant="danger"
 size="lg"
 onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setDeleteTarget(repuesto);
                      }}
/>
                  </div>
                )}
              </>
            );
          }}
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

          <FormField label="Precio de venta (opcional)" error={fieldErrors.precioVenta}>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej: 15000"
              value={editPrecioVenta}
              onChange={(e) => setEditPrecioVenta(e.target.value)}
            />
          </FormField>

          <FormField label="Tipo Reparación" required error={fieldErrors.tipoReparacion}>
            <Select
              options={TIPO_REPARACION_OPTIONS}
              placeholder="Seleccionar tipo..."
              value={editTipo}
              onChange={(e) => setEditTipo(e.target.value)}
            />
          </FormField>

          <FormField label="Marca">
            <Select
              options={(marcasReq.data ?? []).map((m) => ({
                value: String(m.id),
                label: m.nombre,
              }))}
              placeholder="Seleccionar marca (opcional)..."
              value={editMarcaId}
              onChange={(e) => setEditMarcaId(e.target.value)}
            />
          </FormField>

          <div className="sm:col-span-2">
            <FormField label="Modelos compatibles">
              <ModelosCompatiblesSelect
                modelos={modelosReq.data ?? []}
                marcas={marcasReq.data ?? []}
                value={editModeloIds}
                onChange={setEditModeloIds}
              />
            </FormField>
          </div>
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
