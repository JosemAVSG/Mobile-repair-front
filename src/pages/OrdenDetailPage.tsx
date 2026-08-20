import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { TicketEquipoModal } from '../components/organisms/TicketEquipoModal';
import { OrderTimeline, type TimelineEvent } from '../components/molecules/OrderTimeline';
import { apiPut, apiPost, ApiError } from '../api/client';
import { formatDate, formatDateTime, formatCurrency, tipoDispositivoLabel, TIPO_REPARACION_LABELS } from '../utils/formatters';
import {
  buildWhatsAppLink,
  buildMensajeCita,
  buildMensajeEntregaGeneral,
  copyTextToClipboard,
} from '../utils/whatsapp';
import { isOrdenAtrasada } from '../utils/ordenes';
import { useConfig } from '../context/ConfigContext';
import type { OrdenTrabajo, Reparacion, ReparacionRequest } from '../types';
import { EstadoOrden, TipoReparacion } from '../types';
import {
  useOrden,
  useCliente,
  useDispositivo,
  useModelo,
  useMarcas,
  useModelos,
  useHistorialOrden,
  useTarifas,
} from '../hooks/useQueries';

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
// Cita de entrega helpers
// ──────────────────────────────────────────────

// TODO(config): días estimados configurables
const DIAS_ESTIMADOS_ENTREGA = 3;

/** ISO datetime → valor para <input type="datetime-local"> (YYYY-MM-DDTHH:mm) */
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local (YYYY-MM-DDTHH:mm) → ISO con segundos (YYYY-MM-DDTHH:mm:ss) */
function normalizeEntrega(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

// ──────────────────────────────────────────────
// Labels
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// OrdenDetailPage
// ──────────────────────────────────────────────
// OrdenDetailPage
// ──────────────────────────────────────────────

export function OrdenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { config } = useConfig();
  const ordenId = Number(id);

  // ───── Data ─────

  // Fetch the orden first; enrichment queries below depend on it.
  const {
    data: orden,
    isPending: ordenPending,
    isFetching: ordenFetching,
    error: ordenError,
    refetch,
  } = useOrden(ordenId);

  // Enrichment (non-critical — failures leave fallbacks in place)
  const { data: cliente } = useCliente(orden?.clienteId);

  const { data: dispositivo } = useDispositivo(orden?.dispositivoId ?? undefined);

  const { data: modelo } = useModelo(orden?.modeloId ?? dispositivo?.modeloId);

  // Catálogo de marcas y modelos para resolver nombres del equipo embebido
  const { data: marcas } = useMarcas();
  const { data: modelos } = useModelos();

  const marcaId = orden?.marcaId ?? (modelo ? modelo.marcaId : undefined);
  const marcaNombre = useMemo(() => {
    if (marcaId == null) return undefined;
    return marcas?.find((m) => m.id === marcaId)?.nombre;
  }, [marcas, marcaId]);

  const modeloNombre = useMemo(() => {
    const mid = orden?.modeloId ?? dispositivo?.modeloId;
    if (mid == null) return undefined;
    return modelos?.find((m) => m.id === mid)?.nombre;
  }, [modelos, orden?.modeloId, dispositivo?.modeloId]);

  const marcaEquipo = useMemo(
    () => marcas?.find((m) => m.id === marcaId) ?? null,
    [marcas, marcaId],
  );

  const modeloEquipo = useMemo(() => {
    const mid = orden?.modeloId ?? dispositivo?.modeloId;
    return mid == null ? null : (modelos?.find((m) => m.id === mid) ?? null);
  }, [modelos, orden?.modeloId, dispositivo?.modeloId]);

  // Historial is optional — the endpoint may 404 for entities without events
  const { data: historial = [] } = useHistorialOrden(orden?.id);

  // Loading only until the orden resolves. Enrichment queries (cliente,
  // dispositivo, modelo, historial) are non-critical and may be disabled
  // (e.g. orden without dispositivoId), so waiting on their isPending would
  // block the page forever — they render with fallbacks once loaded.
  const loading = ordenPending || ordenFetching;

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

  const entregaMutation = useMutation({
    mutationFn: ({ targetOrdenId, fechaEntrega }: { targetOrdenId: number; fechaEntrega: string | null }) =>
      apiPut<OrdenTrabajo>(`/api/ordenes/${targetOrdenId}/entrega`, { fechaEntrega }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes'] });
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
  const [ticketOpen, setTicketOpen] = useState(false);
  const [repTipo, setRepTipo] = useState<TipoReparacion | ''>('');
  const [repDescripcion, setRepDescripcion] = useState('');
  const [repPrecio, setRepPrecio] = useState('');
  const [repSubmitting, setRepSubmitting] = useState(false);
  const [repErrors, setRepErrors] = useState<{
    tipo?: string;
    precio?: string;
  }>({});

  // Tarifas para autocompletar el precio de una reparación según el equipo
  const { data: tarifas } = useTarifas();

  const tarifaAuto = useMemo(() => {
    if (repTipo === '') return undefined;
    const list = tarifas ?? [];
    const marcaIdEq = marcaId != null ? Number(marcaId) : null;
    const modeloIdEq =
      orden?.modeloId ?? (dispositivo?.modeloId != null ? Number(dispositivo.modeloId) : null);
    return list.find(
      (t) =>
        t.activa &&
        t.tipo === repTipo &&
        (modeloIdEq != null
          ? t.modeloId === modeloIdEq
          : marcaIdEq != null
            ? t.modeloId == null && t.marcaId === marcaIdEq
            : t.modeloId == null && t.marcaId == null),
    );
  }, [tarifas, repTipo, marcaId, orden?.modeloId, dispositivo?.modeloId]);

  const precioAutoHint = useMemo(() => {
    if (tarifaAuto) {
      return `Precio automático: ${formatCurrency(tarifaAuto.precio)} (tarifa)`;
    }
    return null;
  }, [tarifaAuto]);

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

    let precioFinal: number | null = null;
    if (repPrecio !== '' && !isNaN(Number(repPrecio)) && Number(repPrecio) > 0) {
      precioFinal = Number(repPrecio);
    } else if (tarifaAuto) {
      // Si no se escribió precio, resolver la tarifa automática del equipo
      precioFinal = tarifaAuto.precio;
    }

    if (precioFinal == null) {
      errors.precio = 'Ingrese un precio válido o seleccione un tipo con tarifa automática';
    }
    setRepErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (!orden) return;

    setRepSubmitting(true);
    try {
      const body: ReparacionRequest = {
        tipo: repTipo as TipoReparacion,
        descripcion: repDescripcion.trim() || undefined,
        precio: precioFinal as number,
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
  }, [repTipo, repDescripcion, repPrecio, tarifaAuto, orden, closeRepModal, addReparacionMutation]);

  // ───── Cita de entrega modal ─────

  const [entregaOpen, setEntregaOpen] = useState(false);
  const [entregaFecha, setEntregaFecha] = useState('');
  const [entregaError, setEntregaError] = useState<string | null>(null);
  const [entregaAccion, setEntregaAccion] = useState<'guardar' | 'quitar' | null>(null);

  // Confirmación post-guardado de la cita (para WhatsApp / copiar mensaje)
  const [confirmCita, setConfirmCita] = useState<{
    fechaEntrega: string;
    tipo: 'agendar' | 'reprogramar';
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const openEntregaModal = useCallback(() => {
    setEntregaFecha(toDatetimeLocal(orden?.fechaEntrega));
    setEntregaError(null);
    setEntregaAccion(null);
    setEntregaOpen(true);
  }, [orden]);

  const closeEntregaModal = useCallback(() => {
    setEntregaOpen(false);
    setEntregaError(null);
    setEntregaAccion(null);
  }, []);

  const handleGuardarEntrega = useCallback(async () => {
    if (!orden) return;
    if (!entregaFecha) {
      setEntregaError('Seleccione una fecha y hora de entrega');
      return;
    }
    // Capturar la cita previa ANTES de la mutación para distinguir
    // "agendar" (no había cita) de "reprogramar" (ya existía una).
    const prevFecha = orden.fechaEntrega;
    setEntregaAccion('guardar');
    setEntregaError(null);
    try {
      const nuevaFecha = normalizeEntrega(entregaFecha);
      await entregaMutation.mutateAsync({
        targetOrdenId: orden.id,
        fechaEntrega: nuevaFecha,
      });
      closeEntregaModal();
      setConfirmCita({
        fechaEntrega: nuevaFecha,
        tipo: prevFecha ? 'reprogramar' : 'agendar',
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al agendar la entrega';
      setEntregaError(msg);
    } finally {
      setEntregaAccion(null);
    }
  }, [orden, entregaFecha, entregaMutation, closeEntregaModal]);

  const handleQuitarEntrega = useCallback(async () => {
    if (!orden) return;
    setEntregaAccion('quitar');
    setEntregaError(null);
    try {
      await entregaMutation.mutateAsync({
        targetOrdenId: orden.id,
        fechaEntrega: null,
      });
      closeEntregaModal();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al quitar la cita de entrega';
      setEntregaError(msg);
    } finally {
      setEntregaAccion(null);
    }
  }, [orden, entregaMutation, closeEntregaModal]);

  // ───── WhatsApp (citas de entrega) ─────

  const mensajeConfirm = useMemo(() => {
    if (!confirmCita || !cliente?.nombre) return '';
    return buildMensajeCita({
      tipo: confirmCita.tipo,
      clienteNombre: cliente.nombre,
      fechaEntrega: confirmCita.fechaEntrega,
      nombreTaller: config.nombreTaller,
    });
  }, [confirmCita, cliente, config.nombreTaller]);

  const handleEnviarWhatsApp = useCallback(() => {
    if (!confirmCita || !cliente?.telefono || !mensajeConfirm) return;
    window.open(buildWhatsAppLink(cliente.telefono, mensajeConfirm), '_blank');
  }, [confirmCita, cliente, mensajeConfirm]);

  const handleCopiarMensaje = useCallback(async () => {
    if (!mensajeConfirm) return;
    const ok = await copyTextToClipboard(mensajeConfirm);
    setCopiado(ok);
    window.setTimeout(() => setCopiado(false), 2000);
  }, [mensajeConfirm]);

  // Reenvío del aviso desde la cabecera (fuera del modal de agenda)
  const handleReenviarAviso = useCallback(() => {
    if (!cliente?.telefono || !cliente.nombre) return;
    const mensaje = orden?.fechaEntrega
      ? buildMensajeCita({
          tipo: 'reprogramar',
          clienteNombre: cliente.nombre,
          fechaEntrega: orden.fechaEntrega,
          nombreTaller: config.nombreTaller,
        })
      : buildMensajeEntregaGeneral({
          clienteNombre: cliente.nombre,
          nombreTaller: config.nombreTaller,
        });
    window.open(buildWhatsAppLink(cliente.telefono, mensaje), '_blank');
  }, [cliente, orden?.fechaEntrega, config.nombreTaller]);

  // ───── Reparaciones columns ─────

  const repColumns: Column<Reparacion>[] = useMemo(
    () => [
      {
        key: 'tipo',
        label: 'Tipo',
        render: (row) => (
          <Badge>{TIPO_REPARACION_LABELS[row.tipo] ?? row.tipo}</Badge>
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
        key: 'costoRepuesto',
        label: 'Costo Repuesto',
        render: (row) =>
          row.costoRepuesto != null ? formatCurrency(row.costoRepuesto) : '—',
      },
      {
        key: 'ganancia',
        label: 'Ganancia',
        render: (row) =>
          row.ganancia != null ? formatCurrency(row.ganancia) : '—',
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

  const totalReparaciones = useMemo(
    () => orden?.reparaciones.reduce((sum, r) => sum + r.precio, 0) ?? 0,
    [orden],
  );

  const gananciaTotal = useMemo(() => {
    if (!orden) return null;
    const reparacionesConCosto = orden.reparaciones.filter(
      (r) => r.ganancia != null,
    );
    if (reparacionesConCosto.length === 0) return null;
    return reparacionesConCosto.reduce((sum, r) => sum + (r.ganancia ?? 0), 0);
  }, [orden]);

  const costoMateriales = useMemo(
    () =>
      orden?.reparaciones.reduce((sum, r) => sum + (r.costoRepuesto ?? 0), 0) ??
      0,
    [orden],
  );

  // Entrega estimada: usa la cita agendada si existe; si no, estima
  // fechaEntrada + DIAS_ESTIMADOS_ENTREGA y la marca como "estimada".
  const entregaEstimada = useMemo<
    { tipo: 'agendada' | 'estimada'; valor: string } | null
  >(() => {
    if (!orden) return null;
    if (orden.fechaEntrega) return { tipo: 'agendada', valor: orden.fechaEntrega };
    const fecha = new Date(orden.fechaEntrada);
    if (isNaN(fecha.getTime())) return null;
    fecha.setDate(fecha.getDate() + DIAS_ESTIMADOS_ENTREGA);
    return { tipo: 'estimada', valor: fecha.toISOString() };
  }, [orden]);

  const finalizacion = useMemo(
    () =>
      orden?.estado === EstadoOrden.ENTREGADO && orden.fechaSalida
        ? orden.fechaSalida
        : null,
    [orden],
  );

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
        <Button variant="ghost" onClick={() => navigate('/reparaciones')}>
          ← Volver a Reparaciones
        </Button>
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-slate-500">Reparación no encontrada</p>
            <Button variant="secondary" onClick={() => navigate('/reparaciones')}>
              Volver a Reparaciones
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/reparaciones')}>
          ← Volver a Reparaciones
        </Button>
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar reparación: {error}
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
      <Button variant="ghost" onClick={() => navigate('/reparaciones')}>
        ← Volver a Reparaciones
      </Button>

      {/* ── Header section ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">
              Reparación #{orden.id}
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
                ? `${tipoDispositivoLabel(dispositivo.tipo) ?? dispositivo.tipo}${modeloNombre ? ` - ${modeloNombre}` : ` #${dispositivo.modeloId}`}`
                : orden.tipo || orden.modeloId || orden.marcaId
                  ? `${orden.tipo ? (tipoDispositivoLabel(orden.tipo) ?? orden.tipo) : ''}${marcaNombre ? ` - ${marcaNombre}` : ''}${modeloNombre ? ` - ${modeloNombre}` : ''}`
                  : '—'}
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
            <p>
              <span className="font-medium text-slate-700">
                Entrega estimada:
              </span>{' '}
              {entregaEstimada
                ? entregaEstimada.tipo === 'agendada'
                  ? formatDateTime(entregaEstimada.valor)
                  : `${formatDate(entregaEstimada.valor)} (estimada)`
                : '—'}
            </p>
            <p>
              <span className="font-medium text-slate-700">Finalización:</span>{' '}
              {finalizacion ? formatDateTime(finalizacion) : '—'}
            </p>
            {isOrdenAtrasada(orden) && (
              <div>
                <Badge variant="danger">Entrega atrasada</Badge>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={openEntregaModal}>
            Agendar Entrega
          </Button>
          {cliente?.telefono && (
            <Button variant="secondary" onClick={handleReenviarAviso}>
              Enviar por WhatsApp
            </Button>
          )}
          <Button variant="secondary" onClick={() => setTicketOpen(true)}>
            Ticket QR
          </Button>
        </div>
      </div>

      {/* ── Order Info Card ── */}
      <Card title="Información de la Reparación">
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

          {orden.reparaciones.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  Total reparaciones
                </span>
                <span className="text-slate-700">
                  {formatCurrency(totalReparaciones)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  Costo de materiales
                </span>
                <span className="text-slate-700">
                  {formatCurrency(costoMateriales)}
                </span>
              </div>
              {gananciaTotal != null && (
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-emerald-700">
                    Ganancia estimada total
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(gananciaTotal)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Equipo Section ── */}
      <Card title="Equipo">
        <div className="space-y-4">
          <div>
            <span className="text-sm font-medium text-slate-700">Tipo:</span>
            <p className="mt-1 text-sm text-slate-600">
              {orden.tipo
                ? (tipoDispositivoLabel(orden.tipo) ?? orden.tipo)
                : dispositivo
                  ? (tipoDispositivoLabel(dispositivo.tipo) ?? dispositivo.tipo)
                  : '—'}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700">Marca:</span>
            <p className="mt-1 text-sm text-slate-600">
              {marcaNombre ??
                (marcaId != null ? `Marca #${marcaId}` : '—')}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700">Modelo:</span>
            <p className="mt-1 text-sm text-slate-600">
              {modeloNombre ??
                (orden.modeloId != null || dispositivo?.modeloId != null
                  ? `Modelo #${orden.modeloId ?? dispositivo?.modeloId}`
                  : '—')}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700">
              Número de Serie:
            </span>
            <p className="mt-1 text-sm text-slate-600">
              {orden.numeroSerie ?? dispositivo?.numeroSerie ?? '—'}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700">IMEI:</span>
            <p className="mt-1 text-sm text-slate-600">
              {orden.imei ?? dispositivo?.imei ?? '—'}
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
                label: TIPO_REPARACION_LABELS[t] ?? t,
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

          <FormField label="Precio" required={!tarifaAuto} error={repErrors.precio}>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="15000"
              value={repPrecio}
              onChange={(e) => setRepPrecio(e.target.value)}
            />
            {precioAutoHint && (
              <p className="mt-1 text-xs text-blue-600">{precioAutoHint}</p>
            )}
          </FormField>
        </div>
      </Modal>

      {/* ───── Cita de Entrega Modal ───── */}
      <Modal
        isOpen={entregaOpen}
        onClose={closeEntregaModal}
        title="Agendar Entrega"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeEntregaModal}
              disabled={entregaAccion !== null}
            >
              Cancelar
            </Button>
            {orden.fechaEntrega && (
              <Button
                variant="danger"
                onClick={handleQuitarEntrega}
                loading={entregaAccion === 'quitar'}
                disabled={entregaAccion === 'guardar'}
              >
                Quitar Cita
              </Button>
            )}
            <Button
              onClick={handleGuardarEntrega}
              loading={entregaAccion === 'guardar'}
              disabled={entregaAccion === 'quitar'}
            >
              Guardar Cita
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField
            label="Fecha y hora de entrega"
            required
            error={entregaError ?? undefined}
          >
            <Input
              type="datetime-local"
              value={entregaFecha}
              onChange={(e) => {
                setEntregaFecha(e.target.value);
                setEntregaError(null);
              }}
            />
          </FormField>
        </div>
      </Modal>

      {/* ───── Confirmación de cita (WhatsApp) ───── */}
      <Modal
        isOpen={confirmCita !== null}
        onClose={() => setConfirmCita(null)}
        title={
          confirmCita?.tipo === 'reprogramar'
            ? 'Cita reprogramada'
            : 'Cita agendada'
        }
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCita(null)}>
              Cerrar
            </Button>
            {cliente?.telefono && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => void handleCopiarMensaje()}
                  disabled={copiado}
                >
                  {copiado ? 'Mensaje copiado' : 'Copiar mensaje'}
                </Button>
                <Button onClick={handleEnviarWhatsApp}>
                  Enviar por WhatsApp
                </Button>
              </>
            )}
          </>
        }
      >
        {confirmCita && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              La cita de entrega quedó programada para{' '}
              <span className="font-medium text-slate-800">
                {formatDateTime(confirmCita.fechaEntrega)}
              </span>
              .
            </p>

            {cliente?.telefono ? (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                  Mensaje para {cliente.nombre}
                </p>
                <p className="text-sm text-slate-700">{mensajeConfirm}</p>
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                El cliente no tiene teléfono registrado. No se puede enviar el
                aviso por WhatsApp.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ───── Ticket QR Modal ───── */}
      <TicketEquipoModal
        isOpen={ticketOpen}
        orden={orden}
        marca={marcaEquipo}
        modelo={modeloEquipo}
        onClose={() => setTicketOpen(false)}
      />
    </div>
  );
}
