import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Modal } from '../components/atoms/Modal';
import { Select } from '../components/atoms/Select';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';
import { StatusBadge, estadoConfig } from '../components/molecules/StatusBadge';
import { Badge } from '../components/atoms/Badge';
import { SearchField } from '../components/molecules/SearchField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { FacturaModal } from '../components/organisms/FacturaModal';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { apiPost, apiPut } from '../api/client';
import { formatDateTime, formatCurrency, tipoDispositivoLabel, TIPO_REPARACION_LABELS } from '../utils/formatters';
import { isOrdenAtrasada } from '../utils/ordenes';
import { useAuth } from '../hooks/useAuth';
import type { OrdenTrabajo, Cliente, Marca, Modelo, OrdenRequest } from '../types';
import { EstadoOrden, TipoDispositivo, TipoReparacion } from '../types';
import { buildMarcasPorCategoria } from '../utils/maps';
import { useOrdenes, useClientes, useMarcas, useModelos, useTarifas, useTecnicos } from '../hooks/useQueries';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface OrdenRow {
  id: number;
  cliente: string;
  equipo: string;
  tecnico: string;
  estado: EstadoOrden;
  falloReportado: string | null;
  precioTotal: number | null;
  fechaEntrada: string;
  fechaEntrega: string | null;
  atrasada: boolean;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const ESTADO_LABELS: Record<EstadoOrden, string> = Object.fromEntries(
  Object.values(EstadoOrden).map((estado) => [
    estado,
    estadoConfig[estado].label,
  ]),
) as Record<EstadoOrden, string>;

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

const tipoReparacionOptions = Object.values(TipoReparacion).map((t) => ({
  value: t,
  label: TIPO_REPARACION_LABELS[t],
}));

// ──────────────────────────────────────────────
// OrdenesPage
// ──────────────────────────────────────────────

export function OrdenesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';

  // ───── Estado filter / tabs ─────

  const [estadoFilter, setEstadoFilter] = useState<EstadoOrden | ''>('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Técnico: dos pestañas (Mis reparaciones / Disponibles)
  const [tab, setTab] = useState<'mias' | 'disponibles'>('mias');

  // Admin: todas las órdenes (filtradas por estado en el backend).
  const adminQuery = useOrdenes(estadoFilter || undefined, undefined, isAdmin);

  // Técnico: sus reparaciones y las disponibles (sin técnico asignado).
  const misQuery = useOrdenes(
    undefined,
    { tecnicoId: user?.tecnicoId ?? undefined },
    !isAdmin && user?.tecnicoId != null,
  );
  const disponiblesQuery = useOrdenes(undefined, { sinTecnico: true }, !isAdmin);

  const activeQuery = isAdmin
    ? adminQuery
    : tab === 'mias'
      ? misQuery
      : disponiblesQuery;

  const {
    data: ordenes,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = activeQuery;

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  // ───── Supporting data for enrichment ─────

  const { data: clientes } = useClientes();
  const { data: marcas } = useMarcas();
  const { data: modelos } = useModelos();
  const { data: tecnicos } = useTecnicos();

  const createMutation = useMutation({
    mutationFn: (body: OrdenRequest) => apiPost<OrdenTrabajo>('/api/ordenes', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordenes'] }),
  });

  const asignarMutation = useMutation({
    mutationFn: ({ ordenId, tecnicoId }: { ordenId: number; tecnicoId: number }) =>
      apiPut<OrdenTrabajo>(`/api/ordenes/${ordenId}/tecnico`, { tecnicoId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordenes'] }),
  });

  const clienteMap = useMemo(() => {
    const map = new Map<number, Cliente>();
    clientes?.forEach((c) => map.set(c.id, c));
    return map;
  }, [clientes]);

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

  const tecnicoMap = useMemo(() => {
    const map = new Map<number, string>();
    tecnicos?.forEach((t) => map.set(t.id, t.nombre));
    return map;
  }, [tecnicos]);

  // ───── Enriched rows ─────

  const rows = useMemo<OrdenRow[]>(() => {
    let ordenesList = ordenes ?? [];

    if (filtroTipo) {
      ordenesList = ordenesList.filter((orden) => {
        const tipo = orden.tipo;
        return tipo === filtroTipo;
      });
    }

    if (filtroTecnico) {
      ordenesList = ordenesList.filter(
        (orden) => orden.tecnicoId === Number(filtroTecnico),
      );
    }

    return ordenesList.map((orden) => {
      const cliente = clienteMap.get(orden.clienteId);
      const modeloId = orden.modeloId;
      const modelo = modeloId != null ? modeloMap.get(modeloId) : undefined;
      const marca = modelo ? marcaMap.get(modelo.marcaId) : undefined;

      const tipo = orden.tipo;
      const parts: string[] = [];
      if (tipo) parts.push(tipoDispositivoLabel(tipo) ?? tipo);
      if (marca) parts.push(marca.nombre);
      if (modelo) parts.push(modelo.nombre);
      else if (modeloId != null) parts.push(`Modelo #${modeloId}`);
      const dispLabel = parts.join(' - ') || '—';

      return {
        id: orden.id,
        cliente: cliente?.nombre ?? `Cliente #${orden.clienteId}`,
        equipo: dispLabel,
        tecnico:
          orden.tecnicoId != null
            ? (tecnicoMap.get(orden.tecnicoId) ?? `Técnico #${orden.tecnicoId}`)
            : '—',
        estado: orden.estado,
        falloReportado: orden.falloReportado,
        precioTotal: orden.precioTotal,
        fechaEntrada: orden.fechaEntrada,
        fechaEntrega: orden.fechaEntrega ?? null,
        atrasada: isOrdenAtrasada(orden),
      };
    });
  }, [ordenes, filtroTipo, filtroTecnico, clienteMap, marcaMap, modeloMap, tecnicoMap]);

  // ───── Columns ─────

  const columns: Column<OrdenRow>[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'cliente', label: 'Cliente', sortable: true },
    { key: 'equipo', label: 'Equipo' },
    ...(isAdmin
      ? ([{ key: 'tecnico', label: 'Técnico', sortable: true }] as Column<OrdenRow>[])
      : []),
    {
      key: 'estado',
      label: 'Estado',
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <StatusBadge estado={row.estado} />
          {row.atrasada && <Badge variant="danger">Atrasada</Badge>}
        </span>
      ),
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
    // Solo para el técnico: botón "Asignarme" en la pestaña Disponibles
    ...(!isAdmin && tab === 'disponibles'
      ? ([
          {
            key: 'id',
            label: 'Acciones',
            render: (row: OrdenRow) => (
              <Button
                size="sm"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setAsignTarget(ordenes?.find((o) => o.id === row.id) ?? null);
                }}
              >
                Asignarme
              </Button>
            ),
          },
        ] as Column<OrdenRow>[])
      : []),
  ];

  // ───── Create modal state ─────

  const [createOpen, setCreateOpen] = useState(false);
  const [createClienteId, setCreateClienteId] = useState<number | ''>('');
  const [createMarcaId, setCreateMarcaId] = useState<number | ''>('');
  const [createModeloId, setCreateModeloId] = useState<number | ''>('');
  const [createTipo, setCreateTipo] = useState<TipoDispositivo | ''>('');
  const [createImei, setCreateImei] = useState('');
  const [createSerie, setCreateSerie] = useState('');
  const [createCapacidad, setCreateCapacidad] = useState('');
  const [createTipoGas, setCreateTipoGas] = useState('');
  const [createVoltaje, setCreateVoltaje] = useState('');
  const [createNotasTecnicas, setCreateNotasTecnicas] = useState('');
  const [createFallo, setCreateFallo] = useState('');
  const [createNotas, setCreateNotas] = useState('');
  const [createTipoReparacion, setCreateTipoReparacion] = useState('');
  const [createPrecioRevision, setCreatePrecioRevision] = useState('');
  const [createTecnicoId, setCreateTecnicoId] = useState<number | ''>('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<{
    cliente?: string;
    marca?: string;
    modelo?: string;
    tipo?: string;
    general?: string;
  }>({});

  // ───── Stepper state ─────
  const [paso, setPaso] = useState(1);

  // ───── Asignar (técnico: "Asignarme" en Disponibles) ─────
  const [asignTarget, setAsignTarget] = useState<OrdenTrabajo | null>(null);
  const [asignando, setAsignando] = useState(false);

  const handleAsignar = useCallback(async () => {
    if (!asignTarget || user?.tecnicoId == null) return;
    setAsignando(true);
    try {
      await asignarMutation.mutateAsync({
        ordenId: asignTarget.id,
        tecnicoId: user.tecnicoId,
      });
      setAsignTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al asignar';
      alert(msg);
    } finally {
      setAsignando(false);
    }
  }, [asignTarget, user?.tecnicoId, asignarMutation]);

  // ───── Factura modal state ─────
  const [facturaOpen, setFacturaOpen] = useState(false);
  const [facturaOrden, setFacturaOrden] = useState<OrdenTrabajo | null>(null);

  // ───── Tarifas para autocompletar precio de revisión ─────
  const { data: tarifas } = useTarifas();

  const tarifasEquipo = useMemo(() => {
    if (!createMarcaId && !createModeloId) return [];
    const list = tarifas ?? [];
    return list.filter(
      (t) =>
        t.activa &&
        (t.marcaId == null || (createMarcaId != null && t.marcaId === Number(createMarcaId))) &&
        (t.modeloId == null || (createModeloId != null && t.modeloId === Number(createModeloId))),
    );
  }, [tarifas, createMarcaId, createModeloId]);

  // ───── Cascade: marcas by tipo, modelos by marca ─────

  const marcasFiltradas = useMemo(
    () => buildMarcasPorCategoria(marcas ?? [], createTipo),
    [marcas, createTipo],
  );

  const modelosMarca = useMemo(
    () =>
      createMarcaId
        ? (modelos ?? []).filter((m) => m.marcaId === createMarcaId)
        : [],
    [modelos, createMarcaId],
  );

  // ───── Open / close create modal ─────

  const openCreate = useCallback(
    (preload?: { clienteId?: string }) => {
      const clienteVal = preload?.clienteId ? Number(preload.clienteId) : '';
      setCreateClienteId(
        Number.isFinite(clienteVal) && clienteVal !== '' ? clienteVal : '',
      );
      setCreateMarcaId('');
      setCreateModeloId('');
      setCreateTipo('');
      setCreateImei('');
      setCreateSerie('');
      setCreateCapacidad('');
      setCreateTipoGas('');
      setCreateVoltaje('');
      setCreateNotasTecnicas('');
      setCreateFallo('');
      setCreateNotas('');
      setCreateTipoReparacion('');
      setCreatePrecioRevision('');
      setCreateTecnicoId('');
      setFacturaOpen(false);
      setFacturaOrden(null);
      setCreateErrors({});
      setPaso(1);
      setCreateOpen(true);
    },
    [],
  );

  // Auto-open the create modal with clienteId from query params, once on mount.
  const preloadApplied = useRef(false);
  useEffect(() => {
    if (preloadApplied.current) return;
    if (!searchParams.has('clienteId')) return;
    preloadApplied.current = true;
    openCreate({ clienteId: searchParams.get('clienteId') ?? undefined });
  }, [searchParams, openCreate]);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setCreateClienteId('');
    setCreateMarcaId('');
    setCreateModeloId('');
    setCreateTipo('');
    setCreateImei('');
    setCreateSerie('');
    setCreateCapacidad('');
    setCreateTipoGas('');
    setCreateVoltaje('');
    setCreateNotasTecnicas('');
    setCreateFallo('');
    setCreateNotas('');
    setCreateTipoReparacion('');
    setCreatePrecioRevision('');
    setCreateTecnicoId('');
    setFacturaOpen(false);
    setFacturaOrden(null);
    setCreateErrors({});
    setPaso(1);
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
        marcaId: createMarcaId as number,
        modeloId: createModeloId as number,
        tipo: createTipo as TipoDispositivo,
        numeroSerie: createSerie.trim() || undefined,
        imei: createImei.trim() || undefined,
        capacidad: createCapacidad.trim() || undefined,
        tipoGas: createTipoGas.trim() || undefined,
        voltaje: createVoltaje.trim() || undefined,
        notasTecnicas: createNotasTecnicas.trim() || undefined,
        falloReportado: createFallo.trim() || undefined,
        notas: createNotas.trim() || undefined,
        tipoReparacion: createTipoReparacion
          ? (createTipoReparacion as TipoReparacion)
          : undefined,
        precioRevision: createPrecioRevision
          ? Number(createPrecioRevision)
          : undefined,
        // Técnico: solo el admin elige; el técnico se autoasigna al crear.
        tecnicoId: isAdmin
          ? createTecnicoId !== ''
            ? Number(createTecnicoId)
            : undefined
          : (user?.tecnicoId ?? undefined),
      };
      const created = await createMutation.mutateAsync(body);
      closeCreate();
      setFacturaOrden(created);
      setFacturaOpen(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al crear reparación';
      setCreateErrors({ general: msg });
    } finally {
      setCreateSubmitting(false);
    }
  }, [
    createClienteId,
    createMarcaId,
    createModeloId,
    createTipo,
    createSerie,
    createImei,
    createCapacidad,
    createTipoGas,
    createVoltaje,
    createNotasTecnicas,
    createFallo,
    createNotas,
    createTipoReparacion,
    createPrecioRevision,
    createTecnicoId,
    closeCreate,
    createMutation,
    isAdmin,
    user?.tecnicoId,
  ]);

  // ───── Row click ─────

  const handleRowClick = useCallback(
    (row: OrdenRow) => navigate(`/reparaciones/${row.id}`),
    [navigate],
  );

  // ───── Stepper navigation ─────

  const validatePaso1 = useCallback(() => {
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
    return errors;
  }, [createClienteId, createMarcaId, createModeloId, createTipo]);

  const handleSiguiente = useCallback(() => {
    if (paso === 1) {
      const errors = validatePaso1();
      setCreateErrors((prev) => ({ ...prev, ...errors }));
      if (Object.keys(errors).length > 0) return;
    }
    setPaso((p) => Math.min(p + 1, 3));
  }, [paso, validatePaso1]);

  const handleAtras = useCallback(() => {
    setPaso((p) => Math.max(p - 1, 1));
  }, []);

  // ───── Render ─────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Reparaciones
          </h2>
          <p className="text-sm text-slate-500">
            {isAdmin ? 'Gestión de reparaciones' : 'Gestión de tus reparaciones'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchField
            placeholder="Buscar por ID, cliente, equipo o fallo..."
            value={busqueda}
            onChange={setBusqueda}
          />
          <Button variant="secondary" onClick={() => void refetch()}>
            Refrescar
          </Button>
          <Button onClick={() => openCreate()}>Nueva Reparación</Button>
        </div>
      </div>

      {/* Técnico: pestañas Mis reparaciones / Disponibles */}
      {!isAdmin && (
        <div className="flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {(
            [
              { value: 'mias', label: 'Mis reparaciones' },
              { value: 'disponibles', label: 'Disponibles' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTab(opt.value)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === opt.value
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        {isAdmin && (
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
        )}
        <div className="w-56">
          <Select
            label="Filtrar por Tipo de Dispositivo"
            options={tipoOptions}
            placeholder="Todos los tipos"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          />
        </div>
        {isAdmin && (
          <div className="w-56">
            <Select
              label="Filtrar por Técnico"
              options={
                tecnicos?.map((t) => ({
                  value: String(t.id),
                  label: t.nombre,
                })) ?? []
              }
              placeholder="Todos los técnicos"
              value={filtroTecnico}
              onChange={(e) => setFiltroTecnico(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar reparaciones: {error}
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
          emptyMessage={
            isAdmin
              ? 'No hay reparaciones registradas'
              : tab === 'mias'
                ? 'No tienes reparaciones asignadas'
                : 'No hay reparaciones disponibles'
          }
          keyExtractor={(row) => row.id}
          searchFilter={busqueda}
          onRowClick={handleRowClick}
          getRowClassName={(row) => (row.atrasada ? 'bg-red-50/70' : '')}
        />
      )}

      {/* ───── Create Order Modal ───── */}
      <Modal
        isOpen={createOpen}
        onClose={closeCreate}
        title="Nueva Reparación"
        size="lg"
        footer={
          <>
            {paso > 1 && (
              <Button
                variant="secondary"
                onClick={handleAtras}
                disabled={createSubmitting}
              >
                Atrás
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={closeCreate}
              disabled={createSubmitting}
            >
              Cancelar
            </Button>
            {paso < 3 ? (
              <Button
                onClick={handleSiguiente}
                disabled={createSubmitting}
              >
                Siguiente
              </Button>
            ) : (
              <Button onClick={handleCreate} loading={createSubmitting}>
                Crear Reparación
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {createErrors.general && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {createErrors.general}
            </p>
          )}

          {/* Stepper indicator */}
          <ol className="flex items-center gap-2">
            {[
              { n: 1, label: 'Cliente y Equipo' },
              { n: 2, label: 'Detalles' },
              { n: 3, label: 'Costo' },
            ].map((step, idx) => (
              <li key={step.n} className="flex flex-1 items-center gap-2">
                {idx > 0 && (
                  <div className="h-px flex-1 bg-slate-200" />
                )}
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    paso === step.n
                      ? 'bg-blue-600 text-white'
                      : paso > step.n
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      paso === step.n
                        ? 'bg-white/20'
                        : paso > step.n
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {paso > step.n ? '✓' : step.n}
                  </span>
                  {step.label}
                </div>
              </li>
            ))}
          </ol>

          {/* Paso 1 — Cliente y Equipo */}
          {paso === 1 && (
            <>
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

              <FormField label="Tipo" required error={createErrors.tipo}>
                <Select
                  options={tipoOptions}
                  value={createTipo ? String(createTipo) : ''}
                  onChange={(e) => {
                    const val = e.target.value as TipoDispositivo | '';
                    setCreateTipo(val);
                    setCreateMarcaId('');
                    setCreateModeloId('');
                  }}
                  placeholder="Seleccionar tipo de dispositivo..."
                />
              </FormField>

              <FormField label="Marca" required error={createErrors.marca}>
                <Select
                  options={marcasFiltradas.map((m) => ({
                    value: String(m.id),
                    label: m.nombre,
                  }))}
                  value={createMarcaId ? String(createMarcaId) : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCreateMarcaId(val ? Number(val) : '');
                    setCreateModeloId(''); // reset modelo on marca change
                  }}
                  placeholder={
                    createTipo
                      ? 'Seleccionar marca...'
                      : 'Primero seleccione un tipo'
                  }
                  disabled={!createTipo}
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

              <FormField label="Capacidad (opcional)">
                <Input
                  placeholder="Ej: 128 GB, 200 L, etc."
                  value={createCapacidad}
                  onChange={(e) => setCreateCapacidad(e.target.value)}
                />
              </FormField>

              <FormField label="Tipo de Gas (opcional)">
                <Input
                  placeholder="Ej: R134a, R600a"
                  value={createTipoGas}
                  onChange={(e) => setCreateTipoGas(e.target.value)}
                />
              </FormField>

              <FormField label="Voltaje (opcional)">
                <Input
                  placeholder="Ej: 110V, 220V"
                  value={createVoltaje}
                  onChange={(e) => setCreateVoltaje(e.target.value)}
                />
              </FormField>

              <FormField label="Notas Técnicas (opcional)">
                <textarea
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-blue-500 focus:ring-blue-500"
                  rows={2}
                  placeholder="Especificaciones técnicas adicionales del equipo"
                  value={createNotasTecnicas}
                  onChange={(e) => setCreateNotasTecnicas(e.target.value)}
                />
              </FormField>
            </>
          )}

          {/* Paso 2 — Detalles */}
          {paso === 2 && (
            <>
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
            </>
          )}

          {/* Paso 3 — Costo y Confirmar */}
          {paso === 3 && (
            <>
              {isAdmin && (
                <FormField label="Técnico responsable">
                  <Select
                    options={
                      tecnicos?.map((t) => ({
                        value: String(t.id),
                        label: `${t.nombre} (${t.username})`,
                      })) ?? []
                    }
                    placeholder="Sin asignar"
                    value={createTecnicoId ? String(createTecnicoId) : ''}
                    onChange={(e) =>
                      setCreateTecnicoId(
                        e.target.value ? Number(e.target.value) : '',
                      )
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Opcional: se puede asignar después desde el detalle.
                  </p>
                </FormField>
              )}

              <div className="border-t border-slate-200 pt-4">
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Costo de Revisión
                </p>

                {tarifasEquipo.length > 0 && (
                  <FormField label="Tarifa predefinida">
                    <Select
                      options={tarifasEquipo.map((t) => ({
                        value: String(t.id),
                        label: `${TIPO_REPARACION_LABELS[t.tipo] ?? t.tipo} — ${formatCurrency(t.precio)}`,
                      }))}
                      placeholder="Seleccionar tarifa..."
                      value=""
                      onChange={(e) => {
                        const tarifa = tarifasEquipo.find(
                          (t) => String(t.id) === e.target.value,
                        );
                        if (!tarifa) return;
                        setCreateTipoReparacion(tarifa.tipo);
                        setCreatePrecioRevision(String(tarifa.precio));
                      }}
                    />
                  </FormField>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Tipo de revisión">
                    <Select
                      options={tipoReparacionOptions}
                      placeholder="Seleccionar tipo..."
                      value={createTipoReparacion}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreateTipoReparacion(val);
                        // Autocompletar precio si hay tarifa activa para este tipo/equipo
                        if (val) {
                          const match = tarifasEquipo.find(
                            (t) => t.tipo === val,
                          );
                          if (match) setCreatePrecioRevision(String(match.precio));
                        }
                      }}
                    />
                  </FormField>

                  <FormField label="Precio (manual)">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ej: 15000"
                      value={createPrecioRevision}
                      onChange={(e) => setCreatePrecioRevision(e.target.value)}
                    />
                  </FormField>
                </div>
              </div>

              {/* Resumen */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Resumen
                </p>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Cliente</dt>
                    <dd className="text-right font-medium text-slate-800">
                      {clientes?.find((c) => c.id === createClienteId)?.nombre ??
                        '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Equipo</dt>
                    <dd className="text-right font-medium text-slate-800">
                      {[
                        createTipo ? tipoDispositivoLabel(createTipo) : null,
                        createMarcaId
                          ? marcasFiltradas.find((m) => m.id === createMarcaId)
                              ?.nombre
                          : null,
                        createModeloId
                          ? modelosMarca.find(
                              (m) => m.id === createModeloId,
                            )?.nombre
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' - ') || '—'}
                    </dd>
                  </div>
                  {createTipoReparacion && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Tipo de revisión</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {TIPO_REPARACION_LABELS[
                          createTipoReparacion as TipoReparacion
                        ] ?? createTipoReparacion}
                      </dd>
                    </div>
                  )}
                  {createPrecioRevision && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Total</dt>
                      <dd className="text-right font-semibold text-blue-700">
                        {formatCurrency(Number(createPrecioRevision))}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ───── Factura Modal ───── */}
      <FacturaModal
        isOpen={facturaOpen}
        orden={facturaOrden}
        cliente={facturaOrden ? (clienteMap.get(facturaOrden.clienteId) ?? null) : null}
        marca={
          facturaOrden
            ? (marcaMap.get(facturaOrden.marcaId ?? 0) ?? null)
            : null
        }
        modelo={
          facturaOrden
            ? (modeloMap.get(facturaOrden.modeloId ?? 0) ?? null)
            : null
        }
        onClose={() => setFacturaOpen(false)}
      />

      {/* ───── Confirmar Asignarme (técnico) ───── */}
      <ConfirmDialog
        isOpen={asignTarget !== null}
        title="Asignar reparación"
        message={`¿Quieres asignarte la reparación #${asignTarget?.id}?`}
        confirmLabel="Asignarme"
        cancelLabel="Cancelar"
        variant="warning"
        loading={asignando}
        onConfirm={handleAsignar}
        onCancel={() => setAsignTarget(null)}
      />
    </div>
  );
}
