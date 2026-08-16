import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { Select } from '../components/atoms/Select';
import { Input } from '../components/atoms/Input';
import { Spinner } from '../components/atoms/Spinner';
import { FormField } from '../components/molecules/FormField';
import { StatusBadge } from '../components/molecules/StatusBadge';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { OrderTimeline, type TimelineEvent } from '../components/molecules/OrderTimeline';
import { apiGet, apiPut, apiPost, ApiError } from '../api/client';
import { formatDate, formatDateTime, formatCurrency } from '../utils/formatters';
import type {
  OrdenTrabajo,
  Cliente,
  Dispositivo,
  Modelo,
  Reparacion,
  ReparacionRequest,
  HistorialEntry,
} from '../types';
import { EstadoOrden, TipoReparacion, TipoDispositivo } from '../types';

// ──────────────────────────────────────────────
// Estado transition map
// ──────────────────────────────────────────────

const ESTADO_TRANSITIONS: Partial<Record<EstadoOrden, EstadoOrden[]>> = {
  [EstadoOrden.REGISTRO]: [EstadoOrden.DIAGNOSTICO],
  [EstadoOrden.DIAGNOSTICO]: [EstadoOrden.REPARACION, EstadoOrden.PRESUPUESTO_RECHAZADO],
  [EstadoOrden.REPARACION]: [EstadoOrden.ESPERANDO_REPUESTO, EstadoOrden.ESPERANDO_ENTREGA],
  [EstadoOrden.ESPERANDO_REPUESTO]: [EstadoOrden.REPARACION],
  [EstadoOrden.ESPERANDO_ENTREGA]: [EstadoOrden.ENTREGADO],
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: [],
  [EstadoOrden.ENTREGADO]: [],
};

const TRANSITION_LABELS: Partial<Record<EstadoOrden, string>> = {
  [EstadoOrden.DIAGNOSTICO]: 'Pasar a Diagnóstico',
  [EstadoOrden.REPARACION]: 'Pasar a Reparación',
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: 'Rechazar Presupuesto',
  [EstadoOrden.ESPERANDO_REPUESTO]: 'Esperar Repuesto',
  [EstadoOrden.ESPERANDO_ENTREGA]: 'Esperar Entrega',
  [EstadoOrden.ENTREGADO]: 'Marcar como Entregado',
};

const TRANSITION_VARIANTS: Partial<Record<EstadoOrden, 'primary' | 'secondary' | 'danger' | 'ghost'>> = {
  [EstadoOrden.DIAGNOSTICO]: 'primary',
  [EstadoOrden.REPARACION]: 'primary',
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: 'danger',
  [EstadoOrden.ESPERANDO_REPUESTO]: 'secondary',
  [EstadoOrden.ESPERANDO_ENTREGA]: 'secondary',
  [EstadoOrden.ENTREGADO]: 'primary',
};

// ──────────────────────────────────────────────
// Labels
// ──────────────────────────────────────────────

const tipoReparacionLabels: Record<TipoReparacion, string> = {
  [TipoReparacion.PANTALLA]: 'Pantalla',
  [TipoReparacion.BATERIA]: 'Batería',
  [TipoReparacion.ALTAVOZ]: 'Altavoz',
  [TipoReparacion.MICROFONO]: 'Micrófono',
  [TipoReparacion.CARGADOR]: 'Cargador',
  [TipoReparacion.BOTONES]: 'Botones',
  [TipoReparacion.CÁMARA]: 'Cámara',
  [TipoReparacion.PLACA]: 'Placa',
  [TipoReparacion.SOFTWARE]: 'Software',
  [TipoReparacion.OTRO]: 'Otro',
};

const tipoDispositivoLabels: Record<TipoDispositivo, string> = {
  [TipoDispositivo.CELULAR]: 'Celular',
  [TipoDispositivo.MICROONDAS]: 'Microondas',
  [TipoDispositivo.NEVERA]: 'Nevera',
  [TipoDispositivo.COCINA]: 'Cocina',
  [TipoDispositivo.LAVADORA]: 'Lavadora',
};

// ──────────────────────────────────────────────
// OrdenDetailPage
// ──────────────────────────────────────────────

export function OrdenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ordenId = Number(id);
  const ordenIdValid = Number.isFinite(ordenId);

  // ───── Data ─────

  // Fetch the orden first; enrichment queries below depend on it.
  const {
    data: orden,
    isPending: ordenPending,
    isFetching: ordenFetching,
    error: ordenError,
    refetch,
  } = useQuery({
    queryKey: ['ordenes', ordenId],
    queryFn: () => apiGet<OrdenTrabajo>(`/api/ordenes/${ordenId}`),
    enabled: ordenIdValid,
  });

  // Enrichment (non-critical — failures leave fallbacks in place)
  const { data: cliente, isPending: clientePending, isFetching: clienteFetching } = useQuery({
    queryKey: ['clientes', orden?.clienteId],
    queryFn: () => apiGet<Cliente>(`/api/clientes/${orden?.clienteId}`),
    enabled: ordenIdValid && Boolean(orden?.clienteId),
  });

  const {
    data: dispositivo,
    isPending: dispositivoPending,
    isFetching: dispositivoFetching,
  } = useQuery({
    queryKey: ['dispositivos', orden?.dispositivoId],
    queryFn: () => apiGet<Dispositivo>(`/api/dispositivos/${orden?.dispositivoId}`),
    enabled: ordenIdValid && Boolean(orden?.dispositivoId),
  });

  const {
    data: modelo,
    isPending: modeloPending,
    isFetching: modeloFetching,
  } = useQuery({
    queryKey: ['modelos', dispositivo?.modeloId],
    queryFn: () => apiGet<Modelo>(`/api/modelos/${dispositivo?.modeloId}`),
    enabled: Boolean(dispositivo?.modeloId),
  });

  // Historial is optional — the endpoint may 404 for entities without events
  const {
    data: historial = [],
    isPending: historialPending,
    isFetching: historialFetching,
  } = useQuery({
    queryKey: ['historial', 'ORDEN', orden?.id],
    queryFn: () => apiGet<HistorialEntry[]>(`/api/historial/ORDEN/${orden?.id}`),
    enabled: ordenIdValid && Boolean(orden?.id),
  });

  // Loading until the orden and its (optional) enrichment have settled,
  // matching the previous full-page spinner flow.
  const loading =
    ordenPending ||
    ordenFetching ||
    clientePending ||
    clienteFetching ||
    dispositivoPending ||
    dispositivoFetching ||
    modeloPending ||
    modeloFetching ||
    historialPending ||
    historialFetching;

  const error = useMemo(() => {
    if (!ordenError) return null;
    if (ordenError instanceof ApiError && ordenError.status === 404) {
      return 'NOT_FOUND';
    }
    return ordenError instanceof Error
      ? ordenError.message
      : String(ordenError);
  }, [ordenError]);

  // ───── Mutations ─────

  const transitionMutation = useMutation({
    mutationFn: ({ id: targetId, target }: { id: number; target: EstadoOrden }) =>
      apiPut<OrdenTrabajo>(`/api/ordenes/${targetId}/estado?estado=${target}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes', ordenId] });
      queryClient.invalidateQueries({ queryKey: ['historial'] });
    },
  });

  const addReparacionMutation = useMutation({
    mutationFn: ({ ordenId: targetOrdenId, body }: { ordenId: number; body: ReparacionRequest }) =>
      apiPost<Reparacion>(`/api/ordenes/${targetOrdenId}/reparaciones`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes', ordenId] });
      queryClient.invalidateQueries({ queryKey: ['historial'] });
    },
  });

  // ───── Transition state ─────

  const [transitioningTarget, setTransitioningTarget] =
    useState<EstadoOrden | null>(null);

  const handleTransition = useCallback(
    async (target: EstadoOrden) => {
      if (!orden) return;
      setTransitioningTarget(target);
      try {
        await transitionMutation.mutateAsync({ id: orden.id, target });
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Error al cambiar estado';
        alert(msg);
      } finally {
        setTransitioningTarget(null);
      }
    },
    [orden, transitionMutation],
  );

  // ───── Reparacion modal ─────

  const [repModalOpen, setRepModalOpen] = useState(false);
  const [repTipo, setRepTipo] = useState<TipoReparacion | ''>('');
  const [repDescripcion, setRepDescripcion] = useState('');
  const [repPrecio, setRepPrecio] = useState('');
  const [repSubmitting, setRepSubmitting] = useState(false);
  const [repErrors, setRepErrors] = useState<{
    tipo?: string;
    precio?: string;
  }>({});

  const openRepModal = useCallback(() => {
    setRepTipo('');
    setRepDescripcion('');
    setRepPrecio('');
    setRepErrors({});
    setRepModalOpen(true);
  }, []);

  const closeRepModal = useCallback(() => {
    setRepModalOpen(false);
    setRepErrors({});
  }, []);

  const handleAddReparacion = useCallback(async () => {
    const errors: { tipo?: string; precio?: string } = {};
    if (!repTipo) errors.tipo = 'Seleccione un tipo de reparación';
    if (!repPrecio || isNaN(Number(repPrecio)) || Number(repPrecio) <= 0) {
      errors.precio = 'Ingrese un precio válido mayor a 0';
    }
    setRepErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (!orden) return;

    setRepSubmitting(true);
    try {
      const body: ReparacionRequest = {
        tipo: repTipo as TipoReparacion,
        descripcion: repDescripcion.trim() || undefined,
        precio: Number(repPrecio),
      };
      await addReparacionMutation.mutateAsync({ ordenId: orden.id, body });
      closeRepModal();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al agregar reparación';
      setRepErrors({ precio: msg });
    } finally {
      setRepSubmitting(false);
    }
  }, [repTipo, repDescripcion, repPrecio, orden, closeRepModal, addReparacionMutation]);

  // ───── Reparaciones columns ─────

  const repColumns: Column<Reparacion>[] = useMemo(
    () => [
      {
        key: 'tipo',
        label: 'Tipo',
        render: (row) => (
          <Badge>{tipoReparacionLabels[row.tipo] ?? row.tipo}</Badge>
        ),
      },
      {
        key: 'descripcion',
        label: 'Descripción',
        render: (row) => row.descripcion ?? '—',
      },
      {
        key: 'precio',
        label: 'Precio',
        render: (row) => formatCurrency(row.precio),
      },
      {
        key: 'createdAt',
        label: 'Creado',
        render: (row) => formatDate(row.createdAt),
      },
    ],
    [],
  );

  // ───── Timeline events from historial ─────

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    return historial.map((entry) => ({
      date: entry.createdAt,
      content: entry.contenido,
      type: entry.contenido.includes('creada') ? 'created' as const
        : entry.contenido.includes('estado') || entry.contenido.includes('Estado')
          ? 'status' as const
          : 'note' as const,
    }));
  }, [historial]);

  // ───── Disponible transitions ─────

  const availableTransitions = orden
    ? ESTADO_TRANSITIONS[orden.estado] ?? []
    : [];

  // ───── Render states ─────

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error
  if (error === 'NOT_FOUND') {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/ordenes')}>
          ← Volver a Órdenes
        </Button>
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-slate-500">Orden no encontrada</p>
            <Button variant="secondary" onClick={() => navigate('/ordenes')}>
              Volver a Órdenes
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/ordenes')}>
          ← Volver a Órdenes
        </Button>
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar orden: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!orden) return null;

  // ───── Main render ─────

  return (
    <div className="space-y-6">
      {/* ── Back button ── */}
      <Button variant="ghost" onClick={() => navigate('/ordenes')}>
        ← Volver a Órdenes
      </Button>

      {/* ── Header section ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">
              Orden #{orden.id}
            </h2>
            <StatusBadge estado={orden.estado} />
          </div>

          <div className="space-y-1 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-700">Cliente:</span>{' '}
              {cliente?.nombre ?? `#${orden.clienteId}`}
            </p>
            <p>
              <span className="font-medium text-slate-700">Dispositivo:</span>{' '}
              {dispositivo
                ? `${tipoDispositivoLabels[dispositivo.tipo] ?? dispositivo.tipo}${modelo ? ` - ${modelo.nombre}` : ` #${dispositivo.modeloId}`}`
                : `#${orden.dispositivoId}`}
            </p>
            <p>
              <span className="font-medium text-slate-700">
                Fecha de entrada:
              </span>{' '}
              {formatDateTime(orden.fechaEntrada)}
            </p>
            {orden.fechaSalida && (
              <p>
                <span className="font-medium text-slate-700">
                  Fecha de salida:
                </span>{' '}
                {formatDateTime(orden.fechaSalida)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Order Info Card ── */}
      <Card title="Información de la Orden">
        <div className="space-y-4">
          {orden.falloReportado && (
            <div>
              <span className="text-sm font-medium text-slate-700">
                Fallo Reportado:
              </span>
              <p className="mt-1 text-sm text-slate-600">
                {orden.falloReportado}
              </p>
            </div>
          )}
          {orden.notas && (
            <div>
              <span className="text-sm font-medium text-slate-700">
                Notas:
              </span>
              <p className="mt-1 text-sm text-slate-600">{orden.notas}</p>
            </div>
          )}
          <div>
            <span className="text-sm font-medium text-slate-700">
              Total:
            </span>
            <p className="mt-1 text-lg font-bold text-blue-600">
              {orden.precioTotal != null
                ? formatCurrency(orden.precioTotal)
                : '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Workflow Section ── */}
      {availableTransitions.length > 0 && (
        <Card title="Flujo de Trabajo">
          <div className="flex flex-wrap gap-3">
            {availableTransitions.map((target) => (
              <Button
                key={target}
                variant={TRANSITION_VARIANTS[target] ?? 'primary'}
                onClick={() => handleTransition(target)}
                loading={
                  transitioningTarget === target
                }
              >
                {TRANSITION_LABELS[target] ?? target}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* ── Reparaciones Section ── */}
      <Card title="Reparaciones Realizadas">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {orden.reparaciones.length} reparación(es) registrada(s)
            </p>
            <Button variant="secondary" size="sm" onClick={openRepModal}>
              Agregar Reparación
            </Button>
          </div>

          <DataTable<Reparacion>
            columns={repColumns}
            data={orden.reparaciones}
            loading={false}
            emptyMessage="No se han registrado reparaciones"
            keyExtractor={(row) => row.id}
          />
        </div>
      </Card>

      {/* ── Historial Section ── */}
      {historial.length > 0 && (
        <Card title="Historial">
          <OrderTimeline events={timelineEvents} />
        </Card>
      )}

      {/* ───── Add Reparacion Modal ───── */}
      <Modal
        isOpen={repModalOpen}
        onClose={closeRepModal}
        title="Agregar Reparación"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeRepModal}
              disabled={repSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleAddReparacion} loading={repSubmitting}>
              Agregar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Tipo de Reparación" required error={repErrors.tipo}>
            <Select
              options={Object.values(TipoReparacion).map((t) => ({
                value: t,
                label: tipoReparacionLabels[t] ?? t,
              }))}
              value={repTipo}
              onChange={(e) =>
                setRepTipo(e.target.value as TipoReparacion | '')
              }
              placeholder="Seleccionar tipo..."
            />
          </FormField>

          <FormField label="Descripción">
            <textarea
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              placeholder="Descripción de la reparación (opcional)"
              value={repDescripcion}
              onChange={(e) => setRepDescripcion(e.target.value)}
            />
          </FormField>

          <FormField label="Precio" required error={repErrors.precio}>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="15000"
              value={repPrecio}
              onChange={(e) => setRepPrecio(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
