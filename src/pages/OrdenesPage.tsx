import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Modal } from '../components/atoms/Modal';
import { Select } from '../components/atoms/Select';
import { Spinner } from '../components/atoms/Spinner';
import { FormField } from '../components/molecules/FormField';
import { StatusBadge } from '../components/molecules/StatusBadge';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { useApi } from '../hooks/useApi';
import { apiGet, apiPost } from '../api/client';
import { formatDateTime, formatCurrency } from '../utils/formatters';
import type { OrdenTrabajo, Cliente, Dispositivo, Modelo, OrdenRequest } from '../types';
import { EstadoOrden, TipoDispositivo } from '../types';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface OrdenRow {
  id: number;
  cliente: string;
  dispositivo: string;
  estado: EstadoOrden;
  falloReportado: string | null;
  precioTotal: number | null;
  fechaEntrada: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const tipoDispositivoLabel: Record<TipoDispositivo, string> = {
  [TipoDispositivo.CELULAR]: 'Celular',
  [TipoDispositivo.MICROONDAS]: 'Microondas',
  [TipoDispositivo.NEVERA]: 'Nevera',
  [TipoDispositivo.COCINA]: 'Cocina',
  [TipoDispositivo.LAVADORA]: 'Lavadora',
};

const estadoOptions = [
  { value: '', label: 'Todas' },
  ...Object.values(EstadoOrden).map((estado) => ({
    value: estado,
    label: ESTADO_LABELS[estado],
  })),
];

const ESTADO_LABELS: Record<EstadoOrden, string> = {
  [EstadoOrden.REGISTRO]: 'Registrado',
  [EstadoOrden.DIAGNOSTICO]: 'En Diagnóstico',
  [EstadoOrden.REPARACION]: 'En Reparación',
  [EstadoOrden.ESPERANDO_REPUESTO]: 'Esperando Repuesto',
  [EstadoOrden.ESPERANDO_ENTREGA]: 'Esperando Entrega',
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: 'Presupuesto Rechazado',
  [EstadoOrden.ENTREGADO]: 'Entregado',
};

// ──────────────────────────────────────────────
// OrdenesPage
// ──────────────────────────────────────────────

export function OrdenesPage() {
  const navigate = useNavigate();

  // ───── Estado filter ─────

  const [estadoFilter, setEstadoFilter] = useState<EstadoOrden | ''>('');

  const ordenesFetcher = useCallback(
    () =>
      apiGet<OrdenTrabajo[]>(
        estadoFilter
          ? `/api/ordenes/estado/${estadoFilter}`
          : '/api/ordenes',
      ),
    [estadoFilter],
  );

  const {
    data: ordenes,
    loading,
    error,
    execute: refetch,
  } = useApi(ordenesFetcher, false);

  // Refetch on mount and when filter changes
  useEffect(() => {
    refetch();
  }, [refetch, estadoFilter]);

  // ───── Supporting data for enrichment ─────

  const { data: clientes } = useApi(() => apiGet<Cliente[]>('/api/clientes'));
  const { data: dispositivos } = useApi(() =>
    apiGet<Dispositivo[]>('/api/dispositivos'),
  );
  const { data: modelos } = useApi(() => apiGet<Modelo[]>('/api/modelos'));

  const clienteMap = useMemo(() => {
    const map = new Map<number, Cliente>();
    clientes?.forEach((c) => map.set(c.id, c));
    return map;
  }, [clientes]);

  const dispositivoMap = useMemo(() => {
    const map = new Map<number, Dispositivo>();
    dispositivos?.forEach((d) => map.set(d.id, d));
    return map;
  }, [dispositivos]);

  const modeloMap = useMemo(() => {
    const map = new Map<number, Modelo>();
    modelos?.forEach((m) => map.set(m.id, m));
    return map;
  }, [modelos]);

  // ───── Enriched rows ─────

  const rows = useMemo<OrdenRow[]>(() => {
    return (ordenes ?? []).map((orden) => {
      const cliente = clienteMap.get(orden.clienteId);
      const dispositivo = dispositivoMap.get(orden.dispositivoId);
      const modelo = dispositivo
        ? modeloMap.get(dispositivo.modeloId)
        : null;

      const dispLabel = dispositivo
        ? `${tipoDispositivoLabel[dispositivo.tipo] ?? dispositivo.tipo} - ${modelo?.nombre ?? `Modelo #${dispositivo.modeloId}`}`
        : `Dispositivo #${orden.dispositivoId}`;

      return {
        id: orden.id,
        cliente: cliente?.nombre ?? `Cliente #${orden.clienteId}`,
        dispositivo: dispLabel,
        estado: orden.estado,
        falloReportado: orden.falloReportado,
        precioTotal: orden.precioTotal,
        fechaEntrada: orden.fechaEntrada,
      };
    });
  }, [ordenes, clienteMap, dispositivoMap, modeloMap]);

  // ───── Columns ─────

  const columns: Column<OrdenRow>[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'cliente', label: 'Cliente', sortable: true },
    { key: 'dispositivo', label: 'Dispositivo' },
    {
      key: 'estado',
      label: 'Estado',
      render: (row) => <StatusBadge estado={row.estado} />,
    },
    {
      key: 'falloReportado',
      label: 'Fallo Reportado',
      render: (row) =>
        row.falloReportado
          ? row.falloReportado.length > 50
            ? `${row.falloReportado.slice(0, 50)}…`
            : row.falloReportado
          : '—',
    },
    {
      key: 'precioTotal',
      label: 'Total',
      render: (row) =>
        row.precioTotal != null ? formatCurrency(row.precioTotal) : '—',
    },
    {
      key: 'fechaEntrada',
      label: 'Fecha Entrada',
      sortable: true,
      render: (row) => formatDateTime(row.fechaEntrada),
    },
  ];

  // ───── Create modal state ─────

  const [createOpen, setCreateOpen] = useState(false);
  const [createClienteId, setCreateClienteId] = useState<number | ''>('');
  const [createDispositivoId, setCreateDispositivoId] = useState<
    number | ''
  >('');
  const [createFallo, setCreateFallo] = useState('');
  const [createNotas, setCreateNotas] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<{
    cliente?: string;
    dispositivo?: string;
    general?: string;
  }>({});

  // ───── Cascade: dispositivos by cliente ─────

  const [dispositivosCliente, setDispositivosCliente] = useState<
    Dispositivo[]
  >([]);
  const [loadingDisps, setLoadingDisps] = useState(false);

  useEffect(() => {
    if (createClienteId) {
      setLoadingDisps(true);
      apiGet<Dispositivo[]>(`/api/dispositivos/cliente/${createClienteId}`)
        .then(setDispositivosCliente)
        .catch(() => setDispositivosCliente([]))
        .finally(() => setLoadingDisps(false));
    } else {
      setDispositivosCliente([]);
    }
  }, [createClienteId]);

  // ───── Open / close create modal ─────

  const openCreate = useCallback(() => {
    setCreateClienteId('');
    setCreateDispositivoId('');
    setCreateFallo('');
    setCreateNotas('');
    setCreateErrors({});
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setCreateClienteId('');
    setCreateDispositivoId('');
    setCreateFallo('');
    setCreateNotas('');
    setCreateErrors({});
  }, []);

  // ───── Create submit ─────

  const handleCreate = useCallback(async () => {
    const errors: { cliente?: string; dispositivo?: string } = {};
    if (!createClienteId) errors.cliente = 'Seleccione un cliente';
    if (!createDispositivoId)
      errors.dispositivo = 'Seleccione un dispositivo';
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreateSubmitting(true);
    try {
      const body: OrdenRequest = {
        clienteId: createClienteId as number,
        dispositivoId: createDispositivoId as number,
        falloReportado: createFallo.trim() || undefined,
        notas: createNotas.trim() || undefined,
      };
      await apiPost('/api/ordenes', body);
      closeCreate();
      refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al crear orden';
      setCreateErrors({ general: msg });
    } finally {
      setCreateSubmitting(false);
    }
  }, [
    createClienteId,
    createDispositivoId,
    createFallo,
    createNotas,
    closeCreate,
    refetch,
  ]);

  // ───── Row click ─────

  const handleRowClick = useCallback(
    (row: OrdenRow) => navigate(`/ordenes/${row.id}`),
    [navigate],
  );

  // ───── Render ─────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Órdenes de Trabajo
          </h2>
          <p className="text-sm text-slate-500">
            Gestión de órdenes de reparación
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={refetch}>
            Refrescar
          </Button>
          <Button onClick={openCreate}>Nueva Orden</Button>
        </div>
      </div>

      {/* Estado filter */}
      <div className="flex items-center gap-4">
        <div className="w-56">
          <Select
            label="Filtrar por Estado"
            options={estadoOptions}
            value={estadoFilter}
            onChange={(e) =>
              setEstadoFilter(e.target.value as EstadoOrden | '')
            }
            placeholder=""
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar órdenes: {error}
            </p>
            <Button variant="secondary" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Data table */}
      {!error && (
        <DataTable<OrdenRow>
          columns={columns}
          data={rows}
          loading={loading}
          emptyMessage="No hay órdenes registradas"
          keyExtractor={(row) => row.id}
          onRowClick={handleRowClick}
        />
      )}

      {/* ───── Create Order Modal ───── */}
      <Modal
        isOpen={createOpen}
        onClose={closeCreate}
        title="Nueva Orden de Trabajo"
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeCreate}
              disabled={createSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} loading={createSubmitting}>
              Crear Orden
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createErrors.general && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {createErrors.general}
            </p>
          )}

          <FormField label="Cliente" required error={createErrors.cliente}>
            <Select
              options={
                clientes?.map((c) => ({
                  value: String(c.id),
                  label: c.nombre,
                })) ?? []
              }
              value={createClienteId ? String(createClienteId) : ''}
              onChange={(e) => {
                const val = e.target.value;
                setCreateClienteId(val ? Number(val) : '');
                setCreateDispositivoId(''); // reset dispositivo on cliente change
              }}
              placeholder="Seleccionar cliente..."
            />
          </FormField>

          <FormField
            label="Dispositivo"
            required
            error={createErrors.dispositivo}
          >
            {loadingDisps ? (
              <div className="flex items-center gap-2 py-2">
                <Spinner size="sm" />
                <span className="text-sm text-slate-400">
                  Cargando dispositivos...
                </span>
              </div>
            ) : (
              <Select
                options={dispositivosCliente.map((d) => {
                  const modelo = modeloMap.get(d.modeloId);
                  const tipo = tipoDispositivoLabel[d.tipo] ?? d.tipo;
                  const modeloInfo = modelo?.nombre ?? `#${d.modeloId}`;
                  return {
                    value: String(d.id),
                    label: `${tipo} - ${modeloInfo}`,
                  };
                })}
                value={
                  createDispositivoId ? String(createDispositivoId) : ''
                }
                onChange={(e) =>
                  setCreateDispositivoId(
                    e.target.value ? Number(e.target.value) : '',
                  )
                }
                placeholder={
                  createClienteId
                    ? 'Seleccionar dispositivo...'
                    : 'Primero seleccione un cliente'
                }
                disabled={!createClienteId}
              />
            )}
          </FormField>

          <FormField label="Fallo Reportado">
            <textarea
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              placeholder="Descripción del fallo reportado por el cliente"
              value={createFallo}
              onChange={(e) => setCreateFallo(e.target.value)}
            />
          </FormField>

          <FormField label="Notas">
            <textarea
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              placeholder="Notas internas (opcional)"
              value={createNotas}
              onChange={(e) => setCreateNotas(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
