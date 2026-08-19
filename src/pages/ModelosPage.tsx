import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { SearchField } from '../components/molecules/SearchField';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { Badge } from '../components/atoms/Badge';
import { apiPost, apiDelete } from '../api/client';
import { formatDate, CATEGORIA_MARCA_LABELS, categoriaBadgeConfig } from '../utils/formatters';
import { buildMarcaMap, buildMarcaObjMap, buildMarcaOptions } from '../utils/maps';
import type { Modelo, ModeloRequest } from '../types';
import { CategoriaMarca } from '../types';
import { useMarcas, useModelos } from '../hooks/useQueries';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ModeloRow {
  id: number;
  nombre: string;
  marcaNombre: string;
  marcaCategoria: CategoriaMarca | null;
  createdAt: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const CATEGORIA_FILTER_OPTIONS = [
  { value: CategoriaMarca.CELULARES, label: CATEGORIA_MARCA_LABELS[CategoriaMarca.CELULARES] },
  { value: CategoriaMarca.LINEA_BLANCA, label: CATEGORIA_MARCA_LABELS[CategoriaMarca.LINEA_BLANCA] },
  { value: CategoriaMarca.COMPUTADORAS, label: CATEGORIA_MARCA_LABELS[CategoriaMarca.COMPUTADORAS] },
];

// ──────────────────────────────────────────────
// Modelos Page
// ──────────────────────────────────────────────

export function ModelosPage() {
  const queryClient = useQueryClient();

  const {
    data: modelos,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useModelos();

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const marcasReq = useMarcas();

  const createMutation = useMutation({
    mutationFn: (body: ModeloRequest) => apiPost<Modelo>('/api/modelos', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modelos'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete<unknown>(`/api/modelos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modelos'] }),
  });

  // Filter state
  const [filtroMarca, setFiltroMarca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [marcaId, setMarcaId] = useState('');
  const [filtroCategoriaForm, setFiltroCategoriaForm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ nombre?: string; marcaId?: string }>({});

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Modelo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Build maps
  const marcaMap = useMemo(() => buildMarcaMap(marcasReq.data ?? []), [marcasReq.data]);
  const marcaObjMap = useMemo(() => buildMarcaObjMap(marcasReq.data ?? []), [marcasReq.data]);
  const marcaOptions = useMemo(() => buildMarcaOptions(marcasReq.data ?? []), [marcasReq.data]);

  const formMarcaOptions = useMemo(() => {
    const marcas = marcasReq.data ?? [];
    const filtradas = filtroCategoriaForm
      ? marcas.filter((m) => m.categoria === filtroCategoriaForm)
      : marcas;
    return buildMarcaOptions(filtradas);
  }, [marcasReq.data, filtroCategoriaForm]);

  // Filtered & enriched rows
  const rows = useMemo<ModeloRow[]>(() => {
    const modelosList = modelos ?? [];
    let filtered = modelosList;
    if (filtroMarca) {
      filtered = filtered.filter((m) => String(m.marcaId) === filtroMarca);
    }
    if (filtroCategoria) {
      filtered = filtered.filter(
        (m) => marcaObjMap.get(m.marcaId)?.categoria === filtroCategoria,
      );
    }

    return filtered.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      marcaNombre: marcaMap.get(m.marcaId) ?? `Marca #${m.marcaId}`,
      marcaCategoria: marcaObjMap.get(m.marcaId)?.categoria ?? null,
      createdAt: m.createdAt,
    }));
  }, [modelos, filtroMarca, filtroCategoria, marcaMap, marcaObjMap]);

  // ───── Validation ─────

  const validate = useCallback((): boolean => {
    const errors: { nombre?: string; marcaId?: string } = {};
    if (!nombre.trim()) errors.nombre = 'El nombre es obligatorio';
    if (!marcaId) errors.marcaId = 'La marca es obligatoria';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [nombre, marcaId]);

  // ───── Create ─────

  const handleCreate = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const body: ModeloRequest = {
        nombre: nombre.trim(),
        marcaId: Number(marcaId),
      };
      await createMutation.mutateAsync(body);
      setCreateOpen(false);
      setNombre('');
      setMarcaId('');
      setFiltroCategoriaForm('');
      setFieldErrors({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear modelo';
      setFieldErrors({ nombre: msg });
    } finally {
      setSubmitting(false);
    }
  }, [nombre, marcaId, validate, createMutation]);

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

  // ───── Close modal helpers ─────

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setNombre('');
    setMarcaId('');
    setFiltroCategoriaForm('');
    setFieldErrors({});
  }, []);

  // ───── Columns ─────

  const columns: Column<ModeloRow>[] = [
    { key: 'nombre', label: 'Nombre', sortable: true },
    { key: 'marcaNombre', label: 'Marca', sortable: true },
    {
      key: 'marcaCategoria',
      label: 'Categoría',
      render: (row) => {
        if (!row.marcaCategoria) return '—';
        const cfg = categoriaBadgeConfig(row.marcaCategoria);
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'createdAt',
      label: 'Creado',
      sortable: true,
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (row) => (
        <Button
          variant="danger"
          size="sm"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            // Reconstruct full Modelo from row
            const target = (modelos ?? []).find((m) => m.id === row.id);
            if (target) setDeleteTarget(target);
          }}
        >
          Eliminar
        </Button>
      ),
    },
  ];

  // ───── Render ─────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Modelos</h2>
          <p className="text-sm text-slate-500">
            Gestión de modelos por marca
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          Nuevo Modelo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <SearchField
            placeholder="Buscar modelo..."
            value={busqueda}
            onChange={setBusqueda}
          />
        </div>
        <div className="max-w-xs">
          <Select
            label="Filtrar por Marca"
            options={marcaOptions}
            placeholder="Todas las marcas"
            value={filtroMarca}
            onChange={(e) => setFiltroMarca(e.target.value)}
          />
        </div>
        <div className="max-w-xs">
          <Select
            label="Filtrar por Categoría"
            options={CATEGORIA_FILTER_OPTIONS}
            placeholder="Todas las categorías"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar modelos: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Data table */}
      {!error && (
        <DataTable<ModeloRow>
          columns={columns}
          data={rows}
          loading={loading}
          searchFilter={busqueda}
          emptyMessage="No hay modelos registrados"
          keyExtractor={(row) => row.id}
        />
      )}

      {/* ───── Create Modal ───── */}
      <Modal
        isOpen={createOpen}
        onClose={closeCreate}
        title="Nuevo Modelo"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeCreate} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} loading={submitting}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nombre" required error={fieldErrors.nombre}>
            <Input
              placeholder="Ej: Galaxy S24"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </FormField>

          <FormField label="Categoría">
            <Select
              options={CATEGORIA_FILTER_OPTIONS}
              placeholder="Todas las categorías"
              value={filtroCategoriaForm}
              onChange={(e) => {
                setFiltroCategoriaForm(e.target.value);
                setMarcaId('');
              }}
            />
          </FormField>

          <FormField label="Marca" required error={fieldErrors.marcaId}>
            <Select
              options={formMarcaOptions}
              placeholder="Seleccionar marca..."
              value={marcaId}
              onChange={(e) => setMarcaId(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar Modelo"
        message={`¿Estás seguro de eliminar el modelo "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
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
