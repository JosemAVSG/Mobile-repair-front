import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { SearchField } from '../components/molecules/SearchField';
import { type Column } from '../components/organisms/DataTable';
import { EntityList } from '../components/organisms/EntityList';
import { apiPost, apiPut, apiDelete } from '../api/client';
import { formatDate } from '../utils/formatters';
import type { Cliente, ClienteRequest } from '../types';
import { useClientes } from '../hooks/useQueries';

// ──────────────────────────────────────────────
// Clientes Page
// ──────────────────────────────────────────────

export function ClientesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: clientes,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useClientes();

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const saveMutation = useMutation({
    mutationFn: (body: ClienteRequest) =>
      editTarget
        ? apiPut<Cliente>(`/api/clientes/${editTarget.id}`, body)
        : apiPost<Cliente>('/api/clientes', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete<unknown>(`/api/clientes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  });

  // Modal state (shared for create and edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cliente | null>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ nombre?: string }>({});

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search state
  const [busqueda, setBusqueda] = useState('');

  // ───── Validation ─────

  const validate = useCallback((): boolean => {
    const errors: { nombre?: string } = {};
    if (!nombre.trim()) errors.nombre = 'El nombre es obligatorio';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [nombre]);

  // ───── Open create ─────

  const openCreate = useCallback(() => {
    setEditTarget(null);
    setNombre('');
    setTelefono('');
    setEmail('');
    setFieldErrors({});
    setModalOpen(true);
  }, []);

  // ───── Open edit ─────

  const openEdit = useCallback((cliente: Cliente) => {
    setEditTarget(cliente);
    setNombre(cliente.nombre);
    setTelefono(cliente.telefono ?? '');
    setEmail(cliente.email ?? '');
    setFieldErrors({});
    setModalOpen(true);
  }, []);

  // ───── Close modal ─────

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditTarget(null);
    setNombre('');
    setTelefono('');
    setEmail('');
    setFieldErrors({});
  }, []);

  // ───── Submit ─────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const body: ClienteRequest = {
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
      };
      await saveMutation.mutateAsync(body);
      closeModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar cliente';
      setFieldErrors({ nombre: msg });
    } finally {
      setSubmitting(false);
    }
  }, [nombre, telefono, email, validate, saveMutation, closeModal]);

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

  // ───── Row click ─────

  const handleRowClick = useCallback(
    (cliente: Cliente) => navigate(`/clientes/${cliente.id}`),
    [navigate],
  );

  // ───── Columns ─────

  const columns: Column<Cliente>[] = [
    { key: 'nombre', label: 'Nombre', sortable: true },
    {
      key: 'telefono',
      label: 'Teléfono',
      render: (row) => row.telefono ?? '—',
    },
    {
      key: 'email',
      label: 'Email',
      render: (row) => row.email ?? '—',
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
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              openEdit(row);
            }}
          >
            Editar
          </Button>
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
        </div>
      ),
    },
  ];

  // ───── Render ─────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Clientes</h2>
          <p className="text-sm text-slate-500">Gestión de clientes</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="w-full sm:w-64">
            <SearchField
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={setBusqueda}
            />
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar clientes: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Lista: cards en mobile, toggle Lista/Grilla en desktop */}
      {!error && (
        <EntityList<Cliente>
          columns={columns}
          data={clientes ?? []}
          loading={loading}
          searchFilter={busqueda}
          emptyMessage="No hay clientes registrados"
          keyExtractor={(row) => row.id}
          onRowClick={handleRowClick}
          storageKey="vista-clientes"
          renderCard={(cliente) => (
            <>
              <p className="truncate text-base font-semibold text-slate-900">
                {cliente.nombre}
              </p>
              <div className="mt-1 space-y-0.5 text-sm text-slate-600">
                {cliente.telefono && <p>{cliente.telefono}</p>}
                {cliente.email && <p className="truncate">{cliente.email}</p>}
                {!cliente.telefono && !cliente.email && (
                  <p className="text-slate-400">Sin contacto registrado</p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                <span className="text-xs text-slate-500">
                  Creado {formatDate(cliente.createdAt)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      openEdit(cliente);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setDeleteTarget(cliente);
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </>
          )}
        />
      )}

      {/* ───── Create / Edit Modal ───── */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              {editTarget ? 'Actualizar' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nombre" required error={fieldErrors.nombre}>
            <Input
              placeholder="Nombre del cliente"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </FormField>

          <FormField label="Teléfono">
            <Input
              type="tel"
              placeholder="+56 9 1234 5678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </FormField>

          <FormField label="Email">
            <Input
              type="email"
              placeholder="cliente@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar Cliente"
        message={`¿Estás seguro de eliminar al cliente "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
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
