import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const ordenId = Number(id);

  // ───── Data ─────

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [dispositivo, setDispositivo] = useState<Dispositivo | null>(null);
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ordenData = await apiGet<OrdenTrabajo>(`/api/ordenes/${ordenId}`);
      setOrden(ordenData);

      // Enrichment (non-critical — silence individual failures)
      try {
        const [clienteData, dispositivoData] = await Promise.all([
          apiGet<Cliente>(`/api/clientes/${ordenData.clienteId}`),
          apiGet<Dispositivo>(`/api/dispositivos/${ordenData.dispositivoId}`),
        ]);
        setCliente(clienteData);
        setDispositivo(dispositivoData);

        // Fetch modelo name if dispositivo has one
        if (dispositivoData?.modeloId) {
          apiGet<Modelo>(`/api/modelos/${dispositivoData.modeloId}`)
            .then(setModelo)
            .catch(() => {});
        }
      } catch {
        // Non-critical enrichment failures
      }

      // Try historial (optional endpoint)
      try {
        const historialData = await apiGet<HistorialEntry[]>(
          `/api/historial/ORDEN/${ordenData.id}`,
        );
        setHistorial(historialData);
      } catch {
        setHistorial([]);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        setError('NOT_FOUND');
      } else {
        setError(err instanceof Error ? err.message : 'Error inesperado');
      }
      setOrden(null);
    } finally {
      setLoading(false);
    }
  }, [ordenId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ───── Transition state ─────

  const [transitioningTarget, setTransitioningTarget] =
    useState<EstadoOrden | null>(null);

  const handleTransition = useCallback(
    async (target: EstadoOrden) => {
      if (!orden) return;
      setTransitioningTarget(target);
      try {
        await apiPut(
          `/api/ordenes/${orden.id}/estado?estado=${target}`,
          {},
        );
        await fetchAll();
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Error al cambiar estado';
        alert(msg);
      } finally {
        setTransitioningTarget(null);
      }
    },
    [orden, fetchAll],
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
      await apiPost(`/api/ordenes/${orden.id}/reparaciones`, body);
      closeRepModal();
      await fetchAll();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al agregar reparación';
      setRepErrors({ precio: msg });
    } finally {
      setRepSubmitting(false);
    }
  }, [repTipo, repDescripcion, repPrecio, orden, closeRepModal, fetchAll]);

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
            <Button variant="secondary" onClick={fetchAll}>
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
