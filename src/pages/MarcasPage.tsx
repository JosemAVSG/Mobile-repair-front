import { useState, useCallback, useMemo } from 'react';
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
import { apiPost, apiDelete } from '../api/client';
import { formatDate, CATEGORIA_MARCA_LABELS, categoriaBadgeConfig } from '../utils/formatters';
import type { Marca, MarcaRequest } from '../types';
import { CategoriaMarca } from '../types';
import { useMarcas } from '../hooks/useQueries';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const CATEGORIA_OPTIONS = [
  { value: CategoriaMarca.CELULARES, label: CATEGORIA_MARCA_LABELS[CategoriaMarca.CELULARES] },
  { value: CategoriaMarca.LINEA_BLANCA, label: CATEGORIA_MARCA_LABELS[CategoriaMarca.LINEA_BLANCA] },
  { value: CategoriaMarca.COMPUTADORAS, label: CATEGORIA_MARCA_LABELS[CategoriaMarca.COMPUTADORAS] },
];

// ──────────────────────────────────────────────
// Marcas Page
// ──────────────────────────────────────────────

export function MarcasPage() {
  const queryClient = useQueryClient();

  const {
    data: marcas,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useMarcas();

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const createMutation = useMutation({
    mutationFn: (body: MarcaRequest) => apiPost<Marca>('/api/marcas', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marcas'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete<unknown>(`/api/marcas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marcas'] }),
  });

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<CategoriaMarca | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ nombre?: string; categoria?: string }>({});

  // Filter state
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Marca | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo<Marca[]>(() => {
    const marcasList = marcas ?? [];
    if (!filtroCategoria) return marcasList;
    return marcasList.filter((m) => m.categoria === filtroCategoria);
  }, [marcas, filtroCategoria]);

  // ───── Validation ─────

  const validate = useCallback((): boolean => {
    const errors: { nombre?: string; categoria?: string } = {};
    if (!nombre.trim()) errors.nombre = 'El nombre es obligatorio';
    if (!categoria) errors.categoria = 'La categoría es obligatoria';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [nombre, categoria]);

  // ───── Create ─────

  const handleCreate = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const body: MarcaRequest = {
        nombre: nombre.trim(),
        categoria: categoria as CategoriaMarca,
      };
      await createMutation.mutateAsync(body);
      setCreateOpen(false);
      setNombre('');
      setCategoria('');
      setFieldErrors({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear marca';
      setFieldErrors({ nombre: msg });
    } finally {
      setSubmitting(false);
    }
  }, [nombre, categoria, validate, createMutation]);

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
    setCategoria('');
    setFieldErrors({});
  }, []);

  // ───── Columns ─────

  const columns: Column<Marca>[] = [
    { key: 'nombre', label: 'Nombre', sortable: true },
    {
      key: 'categoria',
      label: 'Categoría',
      sortable: true,
      render: (row) => {
        const cfg = categoriaBadgeConfig(row.categoria);
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
            setDeleteTarget(row);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Marcas</h2>
          <p className="text-sm text-slate-500">Gestión de marcas de dispositivos</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="w-full sm:w-auto"
        >
          Nueva Marca
        </Button>
      </div>

      {/* Filter by Category */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <SearchField
            placeholder="Buscar marca..."
            value={busqueda}
            onChange={setBusqueda}
          />
        </div>
        <div className="max-w-xs">
          <Select
            label="Filtrar por Categoría"
            options={CATEGORIA_OPTIONS}
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
              Error al cargar marcas: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Lista: cards en mobile, toggle Lista/Grilla en desktop */}
      {!error && (
        <EntityList<Marca>
          columns={columns}
          data={rows}
          loading={loading}
          searchFilter={busqueda}
          emptyMessage="No hay marcas registradas"
          keyExtractor={(row) => row.id}
          storageKey="vista-marcas"
          renderCard={(marca) => {
            const cfg = categoriaBadgeConfig(marca.categoria);
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {marca.nombre}
                  </p>
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <span className="text-xs text-slate-500">
                    Creado {formatDate(marca.createdAt)}
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setDeleteTarget(marca);
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </>
            );
          }}
        />
      )}

      {/* ───── Create Modal ───── */}
      <Modal
        isOpen={createOpen}
        onClose={closeCreate}
        title="Nueva Marca"
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
              placeholder="Ej: Samsung"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </FormField>

          <FormField label="Categoría" required error={fieldErrors.categoria}>
            <Select
              options={CATEGORIA_OPTIONS}
              placeholder="Seleccionar categoría..."
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaMarca | '')}
            />
          </FormField>
        </div>
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar Marca"
        message={`¿Estás seguro de eliminar la marca "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
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
