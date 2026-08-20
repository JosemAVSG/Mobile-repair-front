import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Modal } from '../components/atoms/Modal';
import { Select } from '../components/atoms/Select';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';
import { StatusBadge } from '../components/molecules/StatusBadge';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { apiPost } from '../api/client';
import { formatDateTime, formatCurrency, tipoDispositivoLabel, TIPO_DISPOSITIVO_LABELS } from '../utils/formatters';
import type { OrdenTrabajo, Cliente, Dispositivo, Marca, Modelo, OrdenRequest } from '../types';
import { EstadoOrden, TipoDispositivo } from '../types';
import { useOrdenes, useClientes, useDispositivos, useMarcas, useModelos, useDispositivo } from '../hooks/useQueries';

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

const ESTADO_LABELS: Record<EstadoOrden, string> = {
  [EstadoOrden.REGISTRO]: 'Registrado',
  [EstadoOrden.DIAGNOSTICO]: 'En Diagnóstico',
  [EstadoOrden.REPARACION]: 'En Reparación',
  [EstadoOrden.ESPERANDO_REPUESTO]: 'Esperando Repuesto',
  [EstadoOrden.ESPERANDO_ENTREGA]: 'Esperando Entrega',
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: 'Presupuesto Rechazado',
  [EstadoOrden.ENTREGADO]: 'Entregado',
};

const estadoOptions = [
  { value: '', label: 'Todas' },
  ...Object.values(EstadoOrden).map((estado) => ({
    value: estado,
    label: ESTADO_LABELS[estado],
  })),
];

const tipoOptions = Object.values(TipoDispositivo).map((tipo) => ({
  value: tipo,
  label: tipoDispositivoLabel(tipo),
}));

// ──────────────────────────────────────────────
// OrdenesPage
// ──────────────────────────────────────────────

export function OrdenesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // ───── Estado filter ─────

  const [estadoFilter, setEstadoFilter] = useState<EstadoOrden | ''>('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Query key changes with the filter so TanStack Query refetches automatically
  const {
    data: ordenes,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useOrdenes(estadoFilter || undefined);

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  // ───── Supporting data for enrichment ─────

  const { data: clientes } = useClientes();
  const { data: dispositivos } = useDispositivos();
  const { data: marcas } = useMarcas();
  const { data: modelos } = useModelos();

  const createMutation = useMutation({
    mutationFn: (body: OrdenRequest) => apiPost<OrdenTrabajo>('/api/ordenes', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordenes'] }),
  });

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

  const marcaMap = useMemo(() => {
    const map = new Map<number, Marca>();
    marcas?.forEach((m) => map.set(m.id, m));
    return map;
  }, [marcas]);

  const modeloMap = useMemo(() => {
    const map = new Map<number, Modelo>();
    modelos?.forEach((m) => map.set(m.id, m));
    return map;
  }, [modelos]);

  // ───── Enriched rows ─────

  const rows = useMemo<OrdenRow[]>(() => {
    let ordenesList = ordenes ?? [];

    if (filtroTipo) {
      ordenesList = ordenesList.filter((orden) => {
        const dispositivo =
          orden.dispositivoId != null ? dispositivoMap.get(orden.dispositivoId) : undefined;
        const tipo = orden.tipo ?? dispositivo?.tipo;
        return tipo === filtroTipo;
      });
    }

    return ordenesList.map((orden) => {
      const cliente = clienteMap.get(orden.clienteId);
      const dispositivo =
        orden.dispositivoId != null ? dispositivoMap.get(orden.dispositivoId) : undefined;
      const modeloId = orden.modeloId ?? dispositivo?.modeloId;
      const modelo = modeloId != null ? modeloMap.get(modeloId) : undefined;
      const marca = modelo ? marcaMap.get(modelo.marcaId) : undefined;

      const tipo = orden.tipo ?? dispositivo?.tipo;
      const parts: string[] = [];
      if (tipo) parts.push(tipoDispositivoLabel(tipo) ?? tipo);
      if (marca) parts.push(marca.nombre);
      if (modelo) parts.push(modelo.nombre);
      else if (modeloId != null) parts.push(`Modelo #${modeloId}`);
      const dispLabel =
        parts.join(' - ') ||
        (orden.dispositivoId != null ? `Dispositivo #${orden.dispositivoId}` : '—');

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
  }, [ordenes, filtroTipo, clienteMap, dispositivoMap, marcaMap, modeloMap]);

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
  const [createMarcaId, setCreateMarcaId] = useState<number | ''>('');
  const [createModeloId, setCreateModeloId] = useState<number | ''>('');
  const [createTipo, setCreateTipo] = useState<TipoDispositivo | ''>('');
  const [createImei, setCreateImei] = useState('');
  const [createSerie, setCreateSerie] = useState('');
  const [createFallo, setCreateFallo] = useState('');
  const [createNotas, setCreateNotas] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<{
    cliente?: string;
    marca?: string;
    modelo?: string;
    tipo?: string;
    general?: string;
  }>({});

  // ───── Cascade: modelos by marca ─────

  const modelosMarca = useMemo(
    () =>
      createMarcaId
        ? (modelos ?? []).filter((m) => m.marcaId === createMarcaId)
        : [],
    [modelos, createMarcaId],
  );

  // ───── Preload from query params (dispositivoId / clienteId) ─────

  const preloadDispositivoId = useMemo(() => {
    const raw = searchParams.get('dispositivoId');
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : undefined;
  }, [searchParams]);

  const {
    data: preloadedDispositivo,
    isPending: preloadDispPending,
    isFetching: preloadDispFetching,
  } = useDispositivo(preloadDispositivoId);

  // ───── Open / close create modal ─────

  const openCreate = useCallback(
    (preload?: { clienteId?: string; dispositivo?: Dispositivo }) => {
      const clienteVal = preload?.clienteId
        ? Number(preload.clienteId)
        : preload?.dispositivo?.clienteId ?? '';
      setCreateClienteId(
        Number.isFinite(clienteVal) && clienteVal !== '' ? clienteVal : '',
      );
      const disp = preload?.dispositivo;
      setCreateDispositivoId(disp ? disp.id : '');
      setCreateMarcaId(
        disp ? (modeloMap.get(disp.modeloId)?.marcaId ?? '') : '',
      );
      setCreateModeloId(disp ? disp.modeloId : '');
      setCreateTipo(disp ? disp.tipo : '');
      setCreateImei(disp?.imei ?? '');
      setCreateSerie(disp?.numeroSerie ?? '');
      setCreateFallo('');
      setCreateNotas('');
      setCreateErrors({});
      setCreateOpen(true);
    },
    [modeloMap],
  );

  // Auto-open the create modal with preloads from query params, once on mount.
  const preloadApplied = useRef(false);
  useEffect(() => {
    if (preloadApplied.current) return;
    const hasDispositivo = searchParams.has('dispositivoId');
    const hasCliente = searchParams.has('clienteId');
    if (!hasDispositivo && !hasCliente) return;
    if (
      hasDispositivo &&
      preloadDispositivoId != null &&
      (preloadDispPending || preloadDispFetching || modelos == null)
    ) {
      // wait until the dispositivo and the catálogo de modelos resolve
      // to derive marca/modelo fields
      return;
    }
    preloadApplied.current = true;
    openCreate({
      clienteId: searchParams.get('clienteId') ?? undefined,
      dispositivo: preloadedDispositivo,
    });
  }, [
    searchParams,
    openCreate,
    preloadDispositivoId,
    preloadDispPending,
    preloadDispFetching,
    preloadedDispositivo,
    modelos,
  ]);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setCreateClienteId('');
    setCreateDispositivoId('');
    setCreateMarcaId('');
    setCreateModeloId('');
    setCreateTipo('');
    setCreateImei('');
    setCreateSerie('');
    setCreateFallo('');
    setCreateNotas('');
    setCreateErrors({});
  }, []);

  // ───── Create submit ─────

  const handleCreate = useCallback(async () => {
    const errors: {
      cliente?: string;
      marca?: string;
      modelo?: string;
      tipo?: string;
    } = {};
    if (!createClienteId) errors.cliente = 'Seleccione un cliente';
    if (!createMarcaId) errors.marca = 'Seleccione una marca';
    if (!createModeloId) errors.modelo = 'Seleccione un modelo';
    if (!createTipo) errors.tipo = 'Seleccione un tipo';
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreateSubmitting(true);
    try {
      const body: OrdenRequest = {
        clienteId: createClienteId as number,
        // When the modal was opened from an existing device (?dispositivoId=),
        // link the order to that device instead of creating a duplicate one.
        dispositivoId:
          createDispositivoId !== '' ? Number(createDispositivoId) : undefined,
        marcaId: createMarcaId as number,
        modeloId: createModeloId as number,
        tipo: createTipo as TipoDispositivo,
        numeroSerie: createSerie.trim() || undefined,
        imei: createImei.trim() || undefined,
        falloReportado: createFallo.trim() || undefined,
        notas: createNotas.trim() || undefined,
      };
      await createMutation.mutateAsync(body);
      closeCreate();
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
    createMarcaId,
    createModeloId,
    createTipo,
    createSerie,
    createImei,
    createFallo,
    createNotas,
    closeCreate,
    createMutation,
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
          <Button variant="secondary" onClick={() => void refetch()}>
            Refrescar
          </Button>
          <Button onClick={() => openCreate()}>Nueva Orden</Button>
        </div>
      </div>

      {/* Filters */}
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
        <div className="w-56">
          <Select
            label="Filtrar por Tipo de Dispositivo"
            options={tipoOptions}
            placeholder="Todos los tipos"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
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
            <Button variant="secondary" onClick={() => void refetch()}>
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
              }}
              placeholder="Seleccionar cliente..."
            />
          </FormField>

          <FormField label="Marca" required error={createErrors.marca}>
            <Select
              options={
                marcas?.map((m) => ({
                  value: String(m.id),
                  label: m.nombre,
                })) ?? []
              }
              value={createMarcaId ? String(createMarcaId) : ''}
              onChange={(e) => {
                const val = e.target.value;
                setCreateMarcaId(val ? Number(val) : '');
                setCreateModeloId(''); // reset modelo on marca change
              }}
              placeholder="Seleccionar marca..."
            />
          </FormField>

          <FormField label="Modelo" required error={createErrors.modelo}>
            <Select
              options={modelosMarca.map((m) => ({
                value: String(m.id),
                label: m.nombre,
              }))}
              value={createModeloId ? String(createModeloId) : ''}
              onChange={(e) =>
                setCreateModeloId(
                  e.target.value ? Number(e.target.value) : '',
                )
              }
              placeholder={
                createMarcaId
                  ? 'Seleccionar modelo...'
                  : 'Primero seleccione una marca'
              }
              disabled={!createMarcaId}
            />
          </FormField>

          <FormField label="Tipo" required error={createErrors.tipo}>
            <Select
              options={Object.values(TipoDispositivo).map((t) => ({
                value: t,
                label: TIPO_DISPOSITIVO_LABELS[t] ?? t,
              }))}
              value={createTipo ? String(createTipo) : ''}
              onChange={(e) =>
                setCreateTipo(e.target.value as TipoDispositivo | '')
              }
              placeholder="Seleccionar tipo de dispositivo..."
            />
          </FormField>

          <FormField label="IMEI (opcional)">
            <Input
              placeholder="IMEI del dispositivo"
              value={createImei}
              onChange={(e) => setCreateImei(e.target.value)}
            />
          </FormField>

          <FormField label="Número de Serie (opcional)">
            <Input
              placeholder="Número de serie"
              value={createSerie}
              onChange={(e) => setCreateSerie(e.target.value)}
            />
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
