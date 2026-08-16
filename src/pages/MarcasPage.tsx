import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { formatDate } from '../utils/formatters';
import type { Marca, MarcaRequest } from '../types';
import { CategoriaMarca } from '../types';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const CATEGORIA_OPTIONS = [
  { value: CategoriaMarca.CELULARES, label: 'Celulares' },
  { value: CategoriaMarca.LINEA_BLANCA, label: 'Línea Blanca' },
];

const categoriaBadge: Record<CategoriaMarca, { label: string; variant: 'info' | 'warning' | 'default' }> = {
  [CategoriaMarca.CELULARES]: { label: 'Celulares', variant: 'info' },
  [CategoriaMarca.LINEA_BLANCA]: { label: 'Línea Blanca', variant: 'warning' },
};

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
  } = useQuery({
    queryKey: ['marcas'],
    queryFn: () => apiGet<Marca[]>('/api/marcas'),
  });

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

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Marca | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        const cfg = categoriaBadge[row.categoria];
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Marcas</h2>
          <p className="text-sm text-slate-500">Gestión de marcas de dispositivos</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          Nueva Marca
        </Button>
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

      {/* Data table (error does not block data if already loaded) */}
      {!error && (
        <DataTable<Marca>
          columns={columns}
          data={marcas ?? []}
          loading={loading}
          emptyMessage="No hay marcas registradas"
          keyExtractor={(row) => row.id}
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
