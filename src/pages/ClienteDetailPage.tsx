import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { Spinner } from '../components/atoms/Spinner';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { StatusBadge } from '../components/molecules/StatusBadge';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { apiGet, apiPut, apiDelete } from '../api/client';
import { formatDate, formatCurrency } from '../utils/formatters';
import type { Cliente, ClienteRequest, Dispositivo, OrdenTrabajo } from '../types';
import { TipoDispositivo } from '../types';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface DispositivoRow {
  id: number;
  tipo: TipoDispositivo;
  modeloNombre: string;
  identificador: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const tipoBadge: Record<TipoDispositivo, { label: string; variant: 'info' | 'warning' | 'default' }> = {
  [TipoDispositivo.CELULAR]: { label: 'Celular', variant: 'info' },
  [TipoDispositivo.MICROONDAS]: { label: 'Microondas', variant: 'warning' },
  [TipoDispositivo.NEVERA]: { label: 'Nevera', variant: 'default' },
  [TipoDispositivo.COCINA]: { label: 'Cocina', variant: 'warning' },
  [TipoDispositivo.LAVADORA]: { label: 'Lavadora', variant: 'info' },
  [TipoDispositivo.COMPUTADORA]: { label: 'Computadora', variant: 'default' },
};

// ──────────────────────────────────────────────
// Cliente Detail Page
// ──────────────────────────────────────────────

export function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch cliente
  const {
    data: cliente,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['clientes', id],
    queryFn: () => apiGet<Cliente>(`/api/clientes/${id}`),
    enabled: Boolean(id),
  });

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  // Fetch dispositivos by clienteId
  const {
    data: dispositivos,
    isPending: dispPending,
    isFetching: dispFetching,
  } = useQuery({
    queryKey: ['dispositivos', 'cliente', id],
    queryFn: () => apiGet<Dispositivo[]>(`/api/dispositivos/cliente/${id}`),
    enabled: Boolean(id),
  });

  const loadingDisp = dispPending || dispFetching;

  // Fetch ordenes (filter client-side)
  const {
    data: ordenes,
    isPending: ordPending,
    isFetching: ordFetching,
  } = useQuery({
    queryKey: ['ordenes'],
    queryFn: () => apiGet<OrdenTrabajo[]>('/api/ordenes'),
  });

  const loadingOrd = ordPending || ordFetching;

  const updateMutation = useMutation({
    mutationFn: (body: ClienteRequest) => apiPut<Cliente>(`/api/clientes/${cliente?.id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes', id] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete<unknown>(`/api/clientes/${cliente?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      navigate('/clientes');
    },
  });

  // Tab state
  const [tab, setTab] = useState<'dispositivos' | 'ordenes'>('dispositivos');

  // Filter ordenes by clienteId
  const ordenesCliente = useMemo(
    () => (ordenes ?? []).filter((o) => String(o.clienteId) === id),
    [ordenes, id],
  );

  // Enriched dispositivo rows
  const dispRows = useMemo<DispositivoRow[]>(() => {
    return (dispositivos ?? []).map((d) => ({
      id: d.id,
      tipo: d.tipo,
      modeloNombre: `Modelo #${d.modeloId}`,
      identificador: d.imei ?? d.numeroSerie ?? '—',
    }));
  }, [dispositivos]);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErrors, setEditErrors] = useState<{ nombre?: string }>({});

  // Delete state (detail page)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingDetail, setDeletingDetail] = useState(false);

  // ───── Edit modal handlers ─────

  const openEditModal = useCallback(() => {
    if (!cliente) return;
    setEditNombre(cliente.nombre);
    setEditTelefono(cliente.telefono ?? '');
    setEditEmail(cliente.email ?? '');
    setEditErrors({});
    setEditModalOpen(true);
  }, [cliente]);

  const closeEditModal = useCallback(() => {
    setEditModalOpen(false);
    setEditErrors({});
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editNombre.trim()) {
      setEditErrors({ nombre: 'El nombre es obligatorio' });
      return;
    }
    if (!cliente) return;

    setEditSubmitting(true);
    try {
      const body: ClienteRequest = {
        nombre: editNombre.trim(),
        telefono: editTelefono.trim() || undefined,
        email: editEmail.trim() || undefined,
      };
      await updateMutation.mutateAsync(body);
      setEditModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar cliente';
      setEditErrors({ nombre: msg });
    } finally {
      setEditSubmitting(false);
    }
  }, [editNombre, editTelefono, editEmail, cliente, updateMutation]);

  // ───── Delete from detail ─────

  const handleDeleteFromDetail = useCallback(async () => {
    if (!cliente) return;

    setDeletingDetail(true);
    try {
      await deleteMutation.mutateAsync();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      alert(msg);
    } finally {
      setDeletingDetail(false);
    }
  }, [deleteMutation]);

  // ───── Dispositivo columns ─────

  const dispColumns: Column<DispositivoRow>[] = [
    {
      key: 'tipo',
      label: 'Tipo',
      render: (row) => {
        const cfg = tipoBadge[row.tipo];
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    { key: 'modeloNombre', label: 'Modelo' },
    {
      key: 'identificador',
      label: 'IMEI / Serie',
      render: (row) => row.identificador,
    },
    {
      key: 'id',
      label: 'Acciones',
      render: () => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            navigate(`/dispositivos?clienteId=${id}`);
          }}
        >
          Ver
        </Button>
      ),
    },
  ];

  // ───── Orden columns ─────

  const ordColumns: Column<OrdenTrabajo>[] = [
    { key: 'id', label: 'ID', sortable: true },
    {
      key: 'estado',
      label: 'Estado',
      render: (row) => <StatusBadge estado={row.estado} />,
    },
    {
      key: 'falloReportado',
      label: 'Fallo Reportado',
      render: (row) => row.falloReportado ?? '—',
    },
    {
      key: 'precioTotal',
      label: 'Total',
      render: (row) => (row.precioTotal != null ? formatCurrency(row.precioTotal) : '—'),
    },
    {
      key: 'fechaEntrada',
      label: 'Fecha',
      sortable: true,
      render: (row) => formatDate(row.fechaEntrada),
    },
  ];

  // ───── Render ─────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/clientes')}>
          ← Volver a Clientes
        </Button>
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar cliente: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/clientes')}>
          ← Volver a Clientes
        </Button>
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-slate-500">Cliente no encontrado</p>
            <Button variant="secondary" onClick={() => navigate('/clientes')}>
              Volver a Clientes
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/clientes')}>
        ← Volver a Clientes
      </Button>

      {/* Client Info Card */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-slate-800">{cliente.nombre}</h3>
            <div className="space-y-1 text-sm text-slate-600">
              {cliente.telefono && (
                <p>
                  <span className="font-medium text-slate-700">Teléfono:</span>{' '}
                  {cliente.telefono}
                </p>
              )}
              {cliente.email && (
                <p>
                  <span className="font-medium text-slate-700">Email:</span>{' '}
                  {cliente.email}
                </p>
              )}
              <p>
                <span className="font-medium text-slate-700">Fecha de registro:</span>{' '}
                {formatDate(cliente.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openEditModal}>
              Editar
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Eliminar
            </Button>
          </div>
        </div>
      </Card>

      {/* ───── Tabs ───── */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          <button
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === 'dispositivos'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTab('dispositivos')}
          >
            Dispositivos del Cliente
          </button>
          <button
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === 'ordenes'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTab('ordenes')}
          >
            Órdenes del Cliente
          </button>
        </nav>
      </div>

      {/* ───── Dispositivos Tab ───── */}
      {tab === 'dispositivos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">
              Dispositivos del Cliente
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/dispositivos?clienteId=${id}`)}
            >
              Nuevo Dispositivo
            </Button>
          </div>

          {loadingDisp ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <DataTable<DispositivoRow>
              columns={dispColumns}
              data={dispRows}
              loading={false}
              emptyMessage="Este cliente no tiene dispositivos registrados"
              keyExtractor={(row) => row.id}
            />
          )}
        </div>
      )}

      {/* ───── Órdenes Tab ───── */}
      {tab === 'ordenes' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">
            Órdenes del Cliente
          </h3>

          {loadingOrd ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <DataTable<OrdenTrabajo>
              columns={ordColumns}
              data={ordenesCliente}
              loading={false}
              emptyMessage="Este cliente no tiene órdenes registradas"
              keyExtractor={(row) => row.id}
              onRowClick={(row) => navigate(`/ordenes/${row.id}`)}
            />
          )}
        </div>
      )}

      {/* ───── Edit Modal ───── */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title="Editar Cliente"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeEditModal} disabled={editSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} loading={editSubmitting}>
              Actualizar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nombre" required error={editErrors.nombre}>
            <Input
              placeholder="Nombre del cliente"
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
            />
          </FormField>

          <FormField label="Teléfono">
            <Input
              type="tel"
              placeholder="+56 9 1234 5678"
              value={editTelefono}
              onChange={(e) => setEditTelefono(e.target.value)}
            />
          </FormField>

          <FormField label="Email">
            <Input
              type="email"
              placeholder="cliente@ejemplo.com"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteOpen}
        title="Eliminar Cliente"
        message={`¿Estás seguro de eliminar al cliente "${cliente.nombre}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deletingDetail}
        onConfirm={handleDeleteFromDetail}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
