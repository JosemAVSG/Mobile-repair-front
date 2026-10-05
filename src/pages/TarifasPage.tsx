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
import { type Column } from '../components/organisms/DataTable';
import { EntityList } from '../components/organisms/EntityList';
import {
  createTarifa,
  deleteTarifa,
  updateTarifa,
} from '../api/tarifas';
import { ApiError } from '../api/ApiClient';
import { formatCurrency, TIPO_REPARACION_LABELS } from '../utils/formatters';
import { buildMarcaMap, buildModeloMap } from '../utils/maps';
import type { TarifaManoObra, TarifaManoObraRequest } from '../types';
import { TipoReparacion } from '../types';
import { useTarifas, useMarcas, useModelos } from '../hooks/useQueries';
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

interface TarifaRow {
  id: number;
  tipoReparacion: TipoReparacion;
  marcaNombre: string;
  modeloNombre: string;
  precio: number;
}

interface FormErrors {
  tipoReparacion?: string;
  precio?: string;
}

// ──────────────────────────────────────────────
// TarifasPage
// ──────────────────────────────────────────────

export function TarifasPage() {
  const { showToast } = useToast();

  // ───── Filter state ─────
  const [filterTipo, setFilterTipo] = useState<TipoReparacion | ''>('');

  // ───── Data fetching ─────
  const queryClient = useQueryClient();

  const {
    data: tarifas,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useTarifas(filterTipo || undefined);

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
    mutationFn: (body: TarifaManoObraRequest) =>
      editingTarifa
        ? updateTarifa(editingTarifa.id, body)
        : createTarifa(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tarifas'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTarifa(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tarifas'] }),
  });

  // ───── Create/Edit modal state ─────
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTarifa, setEditingTarifa] = useState<TarifaManoObra | null>(null);
  const [editTipo, setEditTipo] = useState('');
  const [editMarcaId, setEditMarcaId] = useState('');
  const [editModeloId, setEditModeloId] = useState('');
  const [editPrecio, setEditPrecio] = useState('');
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
  const [deleteTarget, setDeleteTarget] = useState<TarifaManoObra | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ───── Validation ─────

  const validate = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (!editTipo) errors.tipoReparacion = 'Seleccione un tipo de reparación';
    if (!editPrecio || isNaN(Number(editPrecio)) || Number(editPrecio) < 0) {
      errors.precio = 'Ingrese un precio válido';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editTipo, editPrecio]);

  // ───── Create / Update ─────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const body: TarifaManoObraRequest = {
        tipoReparacion: editTipo as TipoReparacion,
        marcaId: editMarcaId ? Number(editMarcaId) : null,
        modeloId: editModeloId ? Number(editModeloId) : null,
        precio: Number(editPrecio),
      };

      await saveMutation.mutateAsync(body);

      setCreateOpen(false);
      setEditingTarifa(null);
      resetForm();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        // El backend devuelve 409 cuando ya existe una tarifa para la
        // combinación tipo + marca + modelo.
        setFieldErrors({ tipoReparacion: err.message });
      } else {
        const msg = err instanceof Error ? err.message : 'Error al guardar tarifa';
        setFieldErrors({ tipoReparacion: msg });
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    editTipo, editMarcaId, editModeloId, editPrecio,
    validate, saveMutation,
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
    setEditTipo('');
    setEditMarcaId('');
    setEditModeloId('');
    setEditPrecio('');
    setFieldErrors({});
  }, []);

  const openCreate = useCallback(() => {
    setEditingTarifa(null);
    resetForm();
    setCreateOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((tarifa: TarifaManoObra) => {
    setEditingTarifa(tarifa);
    setEditTipo(tarifa.tipoReparacion);
    setEditMarcaId(tarifa.marcaId != null ? String(tarifa.marcaId) : '');
    setEditModeloId(tarifa.modeloId != null ? String(tarifa.modeloId) : '');
    setEditPrecio(String(tarifa.precio));
    setFieldErrors({});
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setEditingTarifa(null);
    resetForm();
  }, [resetForm]);

  // ───── Columns ─────

  const columns: Column<TarifaRow>[] = [
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
      key: 'precio',
      label: 'Precio',
      sortable: true,
      render: (row) => formatCurrency(row.precio),
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (row) => {
        const tarifa = (tarifas ?? []).find((t) => t.id === row.id);
        if (!tarifa) return null;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                openEdit(tarifa);
              }}
            >
              Editar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setDeleteTarget(tarifa);
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
  const rows = useMemo<TarifaRow[]>(() => {
    return (tarifas ?? []).map((t) => ({
      id: t.id,
      tipoReparacion: t.tipoReparacion,
      marcaNombre:
        t.marcaId != null ? (marcaMap.get(t.marcaId) ?? `Marca #${t.marcaId}`) : '—',
      modeloNombre:
        t.modeloId != null ? (modeloMap.get(t.modeloId) ?? `Modelo #${t.modeloId}`) : '—',
      precio: t.precio,
    }));
  }, [tarifas, marcaMap, modeloMap]);

  // ───── Render ─────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Tarifas de mano de obra
          </h2>
          <p className="text-sm text-slate-500">
            Precios por tipo de reparación, marca y modelo
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="w-full sm:w-64">
            <Select
              options={TIPO_REPARACION_OPTIONS}
              placeholder="Todos los tipos"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as TipoReparacion | '')}
            />
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            Nueva Tarifa
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar tarifas: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Lista: cards en mobile, toggle Lista/Grilla en desktop */}
      {!error && (
        <EntityList<TarifaRow>
          columns={columns}
          data={rows}
          loading={loading}
          emptyMessage="No hay tarifas registradas"
          keyExtractor={(row) => row.id}
          storageKey="vista-tarifas"
          renderCard={(row) => {
            const tarifa = (tarifas ?? []).find((t) => t.id === row.id);
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {TIPO_REPARACION_LABELS[row.tipoReparacion] ??
                      row.tipoReparacion}
                  </p>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(row.precio)}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-slate-500">
                  {[row.marcaNombre, row.modeloNombre]
                    .filter((v) => v && v !== '—')
                    .join(' · ') || 'Genérico (todas las marcas)'}
                </p>
                {tarifa && (
                  <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        openEdit(tarifa);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setDeleteTarget(tarifa);
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
        title={editingTarifa ? 'Editar Tarifa' : 'Nueva Tarifa'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeCreate} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              {editingTarifa ? 'Actualizar' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Tipo de reparación"
            required
            error={fieldErrors.tipoReparacion}
          >
            <Select
              options={TIPO_REPARACION_OPTIONS}
              placeholder="Seleccionar tipo..."
              value={editTipo}
              onChange={(e) => setEditTipo(e.target.value)}
            />
          </FormField>

          <FormField label="Precio" required error={fieldErrors.precio}>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej: 15000"
              value={editPrecio}
              onChange={(e) => setEditPrecio(e.target.value)}
            />
          </FormField>

          <FormField label="Marca (opcional)">
            <Select
              options={(marcasReq.data ?? []).map((m) => ({
                value: String(m.id),
                label: m.nombre,
              }))}
              placeholder="Todas las marcas..."
              value={editMarcaId}
              onChange={(e) => {
                setEditMarcaId(e.target.value);
                setEditModeloId('');
              }}
            />
          </FormField>

          <FormField label="Modelo (opcional)">
            <Select
              options={filteredModeloOptions}
              placeholder={
                editMarcaId
                  ? 'Todos los modelos...'
                  : 'Primero seleccione una marca'
              }
              value={editModeloId}
              onChange={(e) => setEditModeloId(e.target.value)}
              disabled={!editMarcaId}
            />
          </FormField>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Sin marca ni modelo la tarifa aplica como precio genérico para ese tipo
          de reparación. La resolución prioriza modelo, luego marca y por último
          el genérico.
        </p>
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar Tarifa"
        message="¿Estás seguro de eliminar esta tarifa? Esta acción no se puede deshacer."
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
