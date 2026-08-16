import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { formatDate } from '../utils/formatters';
import type { Modelo, ModeloRequest, Marca } from '../types';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ModeloRow {
  id: number;
  nombre: string;
  marcaNombre: string;
  createdAt: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function buildMarcaMap(marcas: Marca[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const m of marcas) {
    map.set(m.id, m.nombre);
  }
  return map;
}

function buildMarcaOptions(marcas: Marca[]): { value: string; label: string }[] {
  return marcas.map((m) => ({
    value: String(m.id),
    label: m.nombre,
  }));
}

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
  } = useQuery({
    queryKey: ['modelos'],
    queryFn: () => apiGet<Modelo[]>('/api/modelos'),
  });

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const marcasReq = useQuery({
    queryKey: ['marcas'],
    queryFn: () => apiGet<Marca[]>('/api/marcas'),
  });

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

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [marcaId, setMarcaId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ nombre?: string; marcaId?: string }>({});

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Modelo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Build maps
  const marcaMap = useMemo(() => buildMarcaMap(marcasReq.data ?? []), [marcasReq.data]);
  const marcaOptions = useMemo(() => buildMarcaOptions(marcasReq.data ?? []), [marcasReq.data]);

  // Filtered & enriched rows
  const rows = useMemo<ModeloRow[]>(() => {
    const modelosList = modelos ?? [];
    const filtered = filtroMarca
      ? modelosList.filter((m) => String(m.marcaId) === filtroMarca)
      : modelosList;

    return filtered.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      marcaNombre: marcaMap.get(m.marcaId) ?? `Marca #${m.marcaId}`,
      createdAt: m.createdAt,
    }));
  }, [modelos, filtroMarca, marcaMap]);

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
    setFieldErrors({});
  }, []);

  // ───── Columns ─────

  const columns: Column<ModeloRow>[] = [
    { key: 'nombre', label: 'Nombre', sortable: true },
    { key: 'marcaNombre', label: 'Marca', sortable: true },
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

      {/* Filter by Marca */}
      <div className="max-w-xs">
        <Select
          label="Filtrar por Marca"
          options={marcaOptions}
          placeholder="Todas las marcas"
          value={filtroMarca}
          onChange={(e) => setFiltroMarca(e.target.value)}
        />
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

          <FormField label="Marca" required error={fieldErrors.marcaId}>
            <Select
              options={marcaOptions}
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
