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
import { DataTable, type Column } from '../components/organisms/DataTable';
import { apiPost, apiPut, apiDelete } from '../api/client';
import { formatCurrency, TIPO_REPARACION_LABELS } from '../utils/formatters';
import { buildMarcaMap, buildModeloMap, buildMarcaOptions, buildModeloOptions } from '../utils/maps';
import type { Tarifa, TarifaRequest } from '../types';
import { TipoReparacion } from '../types';
import { useTarifas, useMarcas, useModelos } from '../hooks/useQueries';

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
  marcaNombre: string;
  modeloNombre: string;
  tipo: TipoReparacion;
  precio: number;
  activa: boolean;
}

interface FormErrors {
  marcaId?: string;
  modeloId?: string;
  tipo?: string;
  precio?: string;
}

// ──────────────────────────────────────────────
// TarifasPage
// ──────────────────────────────────────────────

export function TarifasPage() {
  // ───── Filter state ─────
  const [verActivas, setVerActivas] = useState(false);
  const [filterMarcaId, setFilterMarcaId] = useState('');
  const [filterModeloId, setFilterModeloId] = useState('');

  // ───── Data fetching ─────
  const queryClient = useQueryClient();

  const {
    data: tarifas,
    isPending,
    isFetching,
    error: queryError,
    refetch: refetchTarifas,
  } = useTarifas({
    verActivas,
    marcaId: filterMarcaId || undefined,
    modeloId: filterModeloId || undefined,
  });

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const marcasReq = useMarcas();
  const modelosReq = useModelos();

  const saveMutation = useMutation({
    mutationFn: (body: TarifaRequest) =>
      editingTarifa
        ? apiPut<Tarifa>(`/api/tarifas/${editingTarifa.id}`, body)
        : apiPost<Tarifa>('/api/tarifas', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tarifas'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (tarifa: Tarifa) =>
      apiPut<Tarifa>(`/api/tarifas/${tarifa.id}`, { activa: !tarifa.activa }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tarifas'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete<unknown>(`/api/tarifas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tarifas'] }),
  });

  // ───── Create/Edit modal state (declared early — used by memos below) ─────
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTarifa, setEditingTarifa] = useState<Tarifa | null>(null);
  const [editMarcaId, setEditMarcaId] = useState('');
  const [editModeloId, setEditModeloId] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [editPrecio, setEditPrecio] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  // Enrichment maps
  const marcaMap = useMemo(() => buildMarcaMap(marcasReq.data ?? []), [marcasReq.data]);
  const modeloMap = useMemo(() => buildModeloMap(modelosReq.data ?? []), [modelosReq.data]);

  // Filter options
  const marcaOptions = useMemo(() => buildMarcaOptions(marcasReq.data ?? []), [marcasReq.data]);
  const modeloOptions = useMemo(() => buildModeloOptions(modelosReq.data ?? []), [modelosReq.data]);

  // Modelos filtered by selected form marca
  const filteredModeloOptions = useMemo(() => {
    if (!editMarcaId) return modeloOptions;
    return modeloOptions.filter((opt) => {
      const modelo = (modelosReq.data ?? []).find((m) => String(m.id) === opt.value);
      return modelo && String(modelo.marcaId) === editMarcaId;
    });
  }, [modeloOptions, editMarcaId, modelosReq.data]);

  // Enriched rows
  const rows = useMemo<TarifaRow[]>(() => {
    const list = tarifas ?? [];
    return list.map((t) => ({
      id: t.id,
      marcaNombre: t.marcaId != null ? (marcaMap.get(t.marcaId) ?? `Marca #${t.marcaId}`) : '—',
      modeloNombre: t.modeloId != null ? (modeloMap.get(t.modeloId) ?? `Modelo #${t.modeloId}`) : '—',
      tipo: t.tipo,
      precio: t.precio,
      activa: t.activa,
    }));
  }, [tarifas, marcaMap, modeloMap]);

  // ───── Delete state ─────
  const [deleteTarget, setDeleteTarget] = useState<Tarifa | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ───── Validation ─────

  const validate = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (!editTipo) errors.tipo = 'El tipo de reparación es obligatorio';
    if (!editPrecio || isNaN(Number(editPrecio)) || Number(editPrecio) <= 0) {
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
      const body: TarifaRequest = {
        marcaId: editMarcaId ? Number(editMarcaId) : undefined,
        modeloId: editModeloId ? Number(editModeloId) : undefined,
        tipo: editTipo as TipoReparacion,
        precio: Number(editPrecio),
      };

      if (editingTarifa) {
        await apiPut(`/api/tarifas/${editingTarifa.id}`, body);
      } else {
        await apiPost<Tarifa>('/api/tarifas', body);
      }

      setCreateOpen(false);
      setEditingTarifa(null);
      setEditMarcaId('');
      setEditModeloId('');
      setEditTipo('');
      setEditPrecio('');
      setFieldErrors({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar tarifa';
      setFieldErrors({ tipo: msg });
    } finally {
      setSubmitting(false);
    }
  }, [editMarcaId, editModeloId, editTipo, editPrecio, validate, saveMutation]);

  // ───── Toggle active ─────

  const handleToggleActive = useCallback(async (tarifa: Tarifa) => {
    try {
      await toggleActiveMutation.mutateAsync(tarifa);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado';
      alert(msg);
    }
  }, [toggleActiveMutation]);

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

  // ───── Actions ─────

  const openCreate = useCallback(() => {
    setEditingTarifa(null);
    setEditMarcaId('');
    setEditModeloId('');
    setEditTipo('');
    setEditPrecio('');
    setFieldErrors({});
    setCreateOpen(true);
  }, []);

  const openEdit = useCallback((tarifa: Tarifa) => {
    setEditingTarifa(tarifa);
    setEditMarcaId(tarifa.marcaId ? String(tarifa.marcaId) : '');
    setEditModeloId(tarifa.modeloId ? String(tarifa.modeloId) : '');
    setEditTipo(tarifa.tipo);
    setEditPrecio(String(tarifa.precio));
    setFieldErrors({});
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setEditingTarifa(null);
    setEditMarcaId('');
    setEditModeloId('');
    setEditTipo('');
    setEditPrecio('');
    setFieldErrors({});
  }, []);

  // ───── Filter handlers ─────

  const toggleVerActivas = useCallback(() => {
    setVerActivas((prev) => !prev);
    setFilterMarcaId('');
    setFilterModeloId('');
  }, []);

  const handleFilterMarcaChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilterMarcaId(val);
    setFilterModeloId('');
    setVerActivas(false);
  }, []);

  const handleFilterModeloChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilterModeloId(val);
    setFilterMarcaId('');
    setVerActivas(false);
  }, []);

  // ───── Columns ─────

  const columns: Column<TarifaRow>[] = [
    { key: 'marcaNombre', label: 'Marca', sortable: true },
    { key: 'modeloNombre', label: 'Modelo', sortable: true },
    {
      key: 'tipo',
      label: 'Tipo Reparación',
      sortable: true,
      render: (row) => (
        <Badge variant="info">{TIPO_REPARACION_LABELS[row.tipo]}</Badge>
      ),
    },
    {
      key: 'precio',
      label: 'Precio',
      sortable: true,
      render: (row) => formatCurrency(row.precio),
    },
    {
      key: 'activa',
      label: 'Activa',
      sortable: true,
      render: (row) => (
        <Badge variant={row.activa ? 'success' : 'danger'}>
          {row.activa ? 'Sí' : 'No'}
        </Badge>
      ),
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
              variant={tarifa.activa ? 'secondary' : 'primary'}
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                handleToggleActive(tarifa);
              }}
            >
              {tarifa.activa ? 'Desactivar' : 'Activar'}
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

  // ───── Render ─────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tarifas</h2>
          <p className="text-sm text-slate-500">
            Gestión de tarifas de reparación
          </p>
        </div>
        <Button onClick={openCreate}>
          Nueva Tarifa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <Button
          variant={verActivas ? 'primary' : 'secondary'}
          size="sm"
          onClick={toggleVerActivas}
        >
          {verActivas ? 'Ver Todas' : 'Ver Activas'}
        </Button>

        <div className="w-48">
          <Select
            label="Filtrar por Marca"
            options={marcaOptions}
            placeholder="Todas las marcas"
            value={filterMarcaId}
            onChange={handleFilterMarcaChange}
          />
        </div>

        <div className="w-48">
          <Select
            label="Filtrar por Modelo"
            options={modeloOptions}
            placeholder="Todos los modelos"
            value={filterModeloId}
            onChange={handleFilterModeloChange}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar tarifas: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetchTarifas()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Data table */}
      {!error && (
        <DataTable<TarifaRow>
          columns={columns}
          data={rows}
          loading={loading}
          emptyMessage="No hay tarifas configuradas"
          keyExtractor={(row) => row.id}
        />
      )}

      {/* ───── Create / Edit Modal ───── */}
      <Modal
        isOpen={createOpen}
        onClose={closeCreate}
        title={editingTarifa ? 'Editar Tarifa' : 'Nueva Tarifa'}
        size="md"
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
        <div className="space-y-4">
          <FormField label="Marca" error={fieldErrors.marcaId}>
            <Select
              options={marcaOptions}
              placeholder="Seleccionar marca (opcional)..."
              value={editMarcaId}
              onChange={(e) => {
                setEditMarcaId(e.target.value);
                setEditModeloId('');
              }}
            />
          </FormField>

          <FormField label="Modelo" error={fieldErrors.modeloId}>
            <Select
              options={filteredModeloOptions}
              placeholder="Seleccionar modelo (opcional)..."
              value={editModeloId}
              onChange={(e) => setEditModeloId(e.target.value)}
            />
          </FormField>

          <FormField label="Tipo Reparación" required error={fieldErrors.tipo}>
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
              placeholder="Ej: 29990"
              value={editPrecio}
              onChange={(e) => setEditPrecio(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar Tarifa"
        message={`¿Estás seguro de eliminar esta tarifa${deleteTarget?.marcaId ? ` de ${marcaMap.get(deleteTarget.marcaId) ?? ''}` : ''}? Esta acción no se puede deshacer.`}
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
