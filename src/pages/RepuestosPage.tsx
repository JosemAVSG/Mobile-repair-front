import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { SearchField } from '../components/molecules/SearchField';
import { type Column } from '../components/organisms/DataTable';
import { EntityList } from '../components/organisms/EntityList';
import { apiPost, apiPut, apiDelete } from '../api/client';
import { formatCurrency, TIPO_REPARACION_LABELS } from '../utils/formatters';
import { buildMarcaMap, buildModeloMap } from '../utils/maps';
import type { Repuesto, RepuestoRequest } from '../types';
import { TipoReparacion } from '../types';
import { useRepuestos, useMarcas, useModelos } from '../hooks/useQueries';

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
  marcaNombre: string;
  modeloNombre: string;
  tipoReparacion: TipoReparacion;
}

interface FormErrors {
  nombre?: string;
  codigo?: string;
  precioCosto?: string;
  tipoReparacion?: string;
}

// ──────────────────────────────────────────────
// RepuestosPage
// ──────────────────────────────────────────────

export function RepuestosPage() {
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
  const [editMarcaId, setEditMarcaId] = useState('');
  const [editModeloId, setEditModeloId] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  // Modelos filtered by selected marca
  const filteredModeloOptions = useMemo(() => {
    if (!editMarcaId) return [];
    return (modelosReq.data ?? [])
      .filter((m) => m.marcaId === Number(editMarcaId))
      .map((m) => ({ value: String(m.id), label: m.nombre }));
  }, [editMarcaId, modelosReq.data]);

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
    if (!editTipo) errors.tipoReparacion = 'Seleccione un tipo de reparación';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editNombre, editCodigo, editPrecioCosto, editTipo]);

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
        marcaId: editMarcaId ? Number(editMarcaId) : undefined,
        modeloId: editModeloId ? Number(editModeloId) : undefined,
        tipoReparacion: editTipo as TipoReparacion,
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
    editPrecioCosto, editMarcaId, editModeloId, editTipo,
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
    setEditMarcaId('');
    setEditModeloId('');
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
    setEditMarcaId(repuesto.marcaId != null ? String(repuesto.marcaId) : '');
    setEditModeloId(repuesto.modeloId != null ? String(repuesto.modeloId) : '');
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
      key: 'marcaNombre',
      label: 'Marca',
      sortable: true,
      render: (row) => row.marcaNombre,
    },
    {
      key: 'modeloNombre',
      label: 'Modelo',
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

  // Enriched rows
  const rows = useMemo<RepuestoRow[]>(() => {
    return (repuestos ?? []).map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      precioCosto: r.precioCosto,
      marcaNombre:
        r.marcaId != null ? (marcaMap.get(r.marcaId) ?? `Marca #${r.marcaId}`) : '—',
      modeloNombre:
        r.modeloId != null ? (modeloMap.get(r.modeloId) ?? `Modelo #${r.modeloId}`) : '—',
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
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(row.precioCosto)}
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    {[row.marcaNombre, row.modeloNombre]
                      .filter((v) => v && v !== '—')
                      .join(' · ') || '—'}
                  </span>
                </div>
                {repuesto && (
                  <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-2.5">
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
              onChange={(e) => {
                setEditMarcaId(e.target.value);
                setEditModeloId('');
              }}
            />
          </FormField>

          <FormField label="Modelo">
            <Select
              options={filteredModeloOptions}
              placeholder={
                editMarcaId
                  ? 'Seleccionar modelo (opcional)...'
                  : 'Primero seleccione una marca'
              }
              value={editModeloId}
              onChange={(e) => setEditModeloId(e.target.value)}
              disabled={!editMarcaId}
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
