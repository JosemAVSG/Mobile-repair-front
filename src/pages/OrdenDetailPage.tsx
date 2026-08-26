import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { Select } from '../components/atoms/Select';
import { Input } from '../components/atoms/Input';
import { Spinner } from '../components/atoms/Spinner';
import { Icon } from '../components/atoms/Icon';
import { FormField } from '../components/molecules/FormField';
import { StatusBadge, estadoConfig } from '../components/molecules/StatusBadge';
import { puedeSubirFotoEtapa, FOTO_ETAPA_STATES } from '../utils/estados';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { TicketEquipoModal } from '../components/organisms/TicketEquipoModal';
import { FacturaModal } from '../components/organisms/FacturaModal';
import { OrderTimeline, type TimelineEvent } from '../components/molecules/OrderTimeline';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { apiPut, apiPost, ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useCan } from '../hooks/useCan';
import { formatDate, formatDateTime, formatCurrency, tipoDispositivoLabel, TIPO_REPARACION_LABELS } from '../utils/formatters';
import {
  buildWhatsAppLink,
  buildMensajeCita,
  buildMensajeEntregaGeneral,
  copyTextToClipboard,
} from '../utils/whatsapp';
import { isOrdenAtrasada } from '../utils/ordenes';
import { useConfig } from '../context/ConfigContext';
import type { EtapaFoto, FotoOrden, OrdenTrabajo, Reparacion, ReparacionRequest } from '../types';
import { EstadoOrden, TipoReparacion } from '../types';
import {
  useOrden,
  useCliente,
  useModelo,
  useMarcas,
  useModelos,
  useHistorialOrden,
  useTarifas,
  useTecnicos,
  useFotosOrden,
  useSubirFotoOrden,
  useEliminarFotoOrden,
  useRepuestos,
} from '../hooks/useQueries';

// ──────────────────────────────────────────────
// Estado transition map
// ──────────────────────────────────────────────

// Espejo exacto de TransicionEstadoPolicy en el backend.
const ESTADO_TRANSITIONS: Record<EstadoOrden, EstadoOrden[]> = {
  [EstadoOrden.REGISTRO]: [EstadoOrden.DIAGNOSTICO],
  [EstadoOrden.DIAGNOSTICO]: [EstadoOrden.REPARACION, EstadoOrden.PRESUPUESTO_RECHAZADO],
  [EstadoOrden.REPARACION]: [EstadoOrden.ESPERANDO_REPUESTO, EstadoOrden.REPARACION_COMPLETADA],
  [EstadoOrden.ESPERANDO_REPUESTO]: [EstadoOrden.REPARACION],
  [EstadoOrden.REPARACION_COMPLETADA]: [EstadoOrden.CONTROL_CALIDAD],
  [EstadoOrden.CONTROL_CALIDAD]: [EstadoOrden.REPARACION, EstadoOrden.ESPERANDO_ENTREGA],
  [EstadoOrden.ESPERANDO_ENTREGA]: [EstadoOrden.PAGADO],
  [EstadoOrden.PAGADO]: [EstadoOrden.ENTREGADO],
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: [EstadoOrden.DEVUELTO],
  [EstadoOrden.DEVUELTO]: [],
  [EstadoOrden.ENTREGADO]: [EstadoOrden.GARANTIA],
  [EstadoOrden.GARANTIA]: [],
};

// Etiquetas por par origen:destino (permite matices según el estado actual).
const TRANSITION_LABELS: Record<string, string> = {
  'REGISTRO:DIAGNOSTICO': 'Iniciar Diagnóstico',
  'DIAGNOSTICO:REPARACION': 'Aprobar y Reparar',
  'DIAGNOSTICO:PRESUPUESTO_RECHAZADO': 'Rechazar Presupuesto',
  'PRESUPUESTO_RECHAZADO:DEVUELTO': 'Devolver Equipo',
  'REPARACION:ESPERANDO_REPUESTO': 'Esperando Repuesto',
  'REPARACION:REPARACION_COMPLETADA': 'Finalizar Reparación',
  'ESPERANDO_REPUESTO:REPARACION': 'Retomar Reparación',
  'REPARACION_COMPLETADA:CONTROL_CALIDAD': 'Enviar a Control de Calidad',
  'CONTROL_CALIDAD:REPARACION': 'Control Fallido — Reparar de Nuevo',
  'CONTROL_CALIDAD:ESPERANDO_ENTREGA': 'Control OK — Lista para Retiro',
  'ESPERANDO_ENTREGA:PAGADO': 'Registrar Pago',
  'PAGADO:ENTREGADO': 'Marcar como Entregado',
  'ENTREGADO:GARANTIA': 'Activar Garantía',
};

const TRANSITION_VARIANTS: Record<
  string,
  'primary' | 'secondary' | 'danger' | 'ghost'
> = {
  'REGISTRO:DIAGNOSTICO': 'primary',
  'DIAGNOSTICO:REPARACION': 'primary',
  'DIAGNOSTICO:PRESUPUESTO_RECHAZADO': 'danger',
  'PRESUPUESTO_RECHAZADO:DEVUELTO': 'secondary',
  'REPARACION:ESPERANDO_REPUESTO': 'secondary',
  'REPARACION:REPARACION_COMPLETADA': 'primary',
  'ESPERANDO_REPUESTO:REPARACION': 'primary',
  'REPARACION_COMPLETADA:CONTROL_CALIDAD': 'primary',
  'CONTROL_CALIDAD:REPARACION': 'danger',
  'CONTROL_CALIDAD:ESPERANDO_ENTREGA': 'primary',
  'ESPERANDO_ENTREGA:PAGADO': 'primary',
  'PAGADO:ENTREGADO': 'primary',
  'ENTREGADO:GARANTIA': 'secondary',
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

const MAX_FOTO_MB = 10;
const MAX_FOTO_BYTES = MAX_FOTO_MB * 1024 * 1024;

const ETAPAS_FOTO: { etapa: EtapaFoto; titulo: string; descripcion: string }[] = [
  { etapa: 'ANTES', titulo: 'Antes', descripcion: 'Estado inicial del equipo' },
  { etapa: 'DURANTE', titulo: 'Durante', descripcion: 'Durante la reparación' },
  { etapa: 'DESPUES', titulo: 'Después', descripcion: 'Estado final del equipo' },
];

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
  const { user } = useAuth();
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

  const { data: modelo } = useModelo(orden?.modeloId ?? undefined);

  // Catálogo de marcas y modelos para resolver nombres del equipo embebido
  const { data: marcas } = useMarcas();
  const { data: modelos } = useModelos();
  const { data: tecnicos } = useTecnicos();
  const { data: repuestos = [], isPending: repuestosPending } = useRepuestos();

  const esAdmin = user?.rol === 'ADMIN';

  const canViewOrden = useCan('orden:view', orden ?? undefined);
  const canEditOrden = useCan('orden:edit', orden ?? undefined);
  const canManageReparaciones = useCan('reparacion:manage', orden ?? undefined);
  const canManageEntrega = useCan('entrega:manage', orden ?? undefined);
  const canManageFotos = useCan('foto:manage', orden ?? undefined);

  const tecnicoResponsable = useMemo(() => {
    if (orden?.tecnicoId == null) return null;
    return tecnicos?.find((t) => t.id === orden.tecnicoId) ?? null;
  }, [orden?.tecnicoId, tecnicos]);

  // Técnico que verá el select del admin en el detalle
  const tecnicoOptions = useMemo(
    () =>
      tecnicos
        ?.filter((t) => t.activo)
        .map((t) => ({ value: String(t.id), label: `${t.nombre} (${t.username})` })) ?? [],
    [tecnicos],
  );

  const [asignTecnicoSel, setAsignTecnicoSel] = useState('');
  useEffect(() => {
    if (orden?.tecnicoId != null) {
      setAsignTecnicoSel(String(orden.tecnicoId));
    } else {
      setAsignTecnicoSel('');
    }
  }, [orden?.tecnicoId]);

  const marcaId = orden?.marcaId ?? (modelo ? modelo.marcaId : undefined);
  const marcaNombre = useMemo(() => {
    if (marcaId == null) return undefined;
    return marcas?.find((m) => m.id === marcaId)?.nombre;
  }, [marcas, marcaId]);

  const modeloNombre = useMemo(() => {
    const mid = orden?.modeloId;
    if (mid == null) return undefined;
    return modelos?.find((m) => m.id === mid)?.nombre;
  }, [modelos, orden?.modeloId]);

  const marcaEquipo = useMemo(
    () => marcas?.find((m) => m.id === marcaId) ?? null,
    [marcas, marcaId],
  );

  const modeloEquipo = useMemo(() => {
    const mid = orden?.modeloId;
    return mid == null ? null : (modelos?.find((m) => m.id === mid) ?? null);
  }, [modelos, orden?.modeloId]);

  // Historial is optional — the endpoint may 404 for entities without events
  const { data: historial = [] } = useHistorialOrden(orden?.id);

  // Loading only until the orden resolves. Enrichment queries (cliente,
  // modelo, historial) are non-critical, so waiting on their isPending would
  // block the page forever — they render with fallbacks once loaded.
  const loading = ordenPending || ordenFetching;

  const error = useMemo(() => {
    if (!ordenError) return null;
    if (ordenError instanceof ApiError && ordenError.status === 404) {
      return 'NOT_FOUND';
    }
    if (ordenError instanceof ApiError && ordenError.status === 403) {
      return 'FORBIDDEN';
    }
    return ordenError instanceof Error
      ? ordenError.message
      : String(ordenError);
  }, [ordenError]);

  // ───── Mutations ─────

  const transitionMutation = useMutation({
    mutationFn: ({ id: targetId, target, descuentoDiagnostico }: { id: number; target: EstadoOrden; descuentoDiagnostico?: boolean }) => {
      let url = `/api/ordenes/${targetId}/estado?estado=${target}`;
      if (descuentoDiagnostico != null) {
        url += `&descuentoDiagnostico=${descuentoDiagnostico}`;
      }
      return apiPut<OrdenTrabajo>(url, {});
    },
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

  const asignarTecnicoMutation = useMutation({
    mutationFn: ({ targetOrdenId, tecnicoId }: { targetOrdenId: number; tecnicoId: number | null }) =>
      apiPut<OrdenTrabajo>(`/api/ordenes/${targetOrdenId}/tecnico`, { tecnicoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes', ordenId] });
      queryClient.invalidateQueries({ queryKey: ['historial'] });
    },
  });

  // ───── Fotos del equipo (data + mutations) ─────

  const {
    data: fotos = [],
    isPending: fotosPending,
    isFetching: fotosFetching,
    error: fotosError,
  } = useFotosOrden(ordenId);

  const subirFotoMutation = useSubirFotoOrden(ordenId);
  const eliminarFotoMutation = useEliminarFotoOrden(ordenId);

  const fotosLoading = fotosPending || fotosFetching;
  const fotosErrorMessage =
    fotosError instanceof Error ? fotosError.message : String(fotosError);

  const fotosPorEtapa = useMemo(() => {
    const grupos: Record<EtapaFoto, FotoOrden[]> = {
      ANTES: [],
      DURANTE: [],
      DESPUES: [],
    };
    for (const foto of fotos) {
      grupos[foto.etapa].push(foto);
    }
    return grupos;
  }, [fotos]);

  // ───── Fotos del equipo (state) ─────

  const [selectedFiles, setSelectedFiles] = useState<
    Partial<Record<EtapaFoto, File>>
  >({});
  const [previews, setPreviews] = useState<
    Partial<Record<EtapaFoto, string>>
  >({});
  const [uploadErrors, setUploadErrors] = useState<
    Partial<Record<EtapaFoto, string>>
  >({});
  const [subiendoEtapa, setSubiendoEtapa] = useState<EtapaFoto | null>(null);
  const [fotoAEliminar, setFotoAEliminar] = useState<FotoOrden | null>(null);
  const fileInputRef = useRef<Partial<Record<EtapaFoto, HTMLInputElement | null>>>({});

  // Libera los object URLs creados al previsualizar archivos.
  useEffect(() => {
    const urls = Object.values(previews);
    return () => {
      for (const url of urls) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, [previews]);

  const limpiarSeleccion = useCallback((etapa: EtapaFoto) => {
    setSelectedFiles((prev) => {
      const next = { ...prev };
      delete next[etapa];
      return next;
    });
    setPreviews((prev) => {
      const next = { ...prev };
      if (next[etapa]) URL.revokeObjectURL(next[etapa]!);
      delete next[etapa];
      return next;
    });
    const input = fileInputRef.current[etapa];
    if (input) input.value = '';
  }, []);

  const handleSeleccionarArchivo = useCallback(
    (etapa: EtapaFoto, file: File | undefined) => {
      if (!file) return;
      const formatoOk = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      const tamOk = file.size <= MAX_FOTO_BYTES;
      if (!formatoOk || !tamOk) {
        setUploadErrors((prev) => ({
          ...prev,
          [etapa]: `Solo se permiten imágenes JPG, PNG o WEBP de hasta ${MAX_FOTO_MB} MB`,
        }));
        return;
      }
      setUploadErrors((prev) => ({ ...prev, [etapa]: undefined }));
      setPreviews((prev) => {
        if (prev[etapa]) URL.revokeObjectURL(prev[etapa]!);
        return { ...prev, [etapa]: URL.createObjectURL(file) };
      });
      setSelectedFiles((prev) => ({ ...prev, [etapa]: file }));
    },
    [],
  );

  const handleSubirFoto = useCallback(
    async (etapa: EtapaFoto) => {
      const file = selectedFiles[etapa];
      if (!file) return;
      setSubiendoEtapa(etapa);
      setUploadErrors((prev) => ({ ...prev, [etapa]: undefined }));
      try {
        await subirFotoMutation.mutateAsync({ file, etapa });
        limpiarSeleccion(etapa);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Error al subir la foto';
        setUploadErrors((prev) => ({ ...prev, [etapa]: msg }));
      } finally {
        setSubiendoEtapa(null);
      }
    },
    [selectedFiles, subirFotoMutation, limpiarSeleccion],
  );

  const handleEliminarFoto = useCallback(async () => {
    if (!fotoAEliminar) return;
    try {
      await eliminarFotoMutation.mutateAsync(fotoAEliminar.id);
      setFotoAEliminar(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al eliminar la foto';
      alert(msg);
    }
  }, [fotoAEliminar, eliminarFotoMutation]);

  // ───── Técnico responsable state ─────

  const [facturaOpen, setFacturaOpen] = useState(false);
  const [confirmAsignarme, setConfirmAsignarme] = useState(false);
  const [asignando, setAsignando] = useState(false);

  const handleAsignarme = useCallback(async () => {
    if (!orden || user?.tecnicoId == null) return;
    setAsignando(true);
    try {
      await asignarTecnicoMutation.mutateAsync({
        targetOrdenId: orden.id,
        tecnicoId: user.tecnicoId,
      });
      setConfirmAsignarme(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al asignar';
      alert(msg);
    } finally {
      setAsignando(false);
    }
  }, [orden, user?.tecnicoId, asignarTecnicoMutation]);

  const handleAsignarSelect = useCallback(async () => {
    if (!orden) return;
    setAsignando(true);
    try {
      const tecnicoId = asignTecnicoSel !== '' ? Number(asignTecnicoSel) : null;
      await asignarTecnicoMutation.mutateAsync({ targetOrdenId: orden.id, tecnicoId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al asignar técnico';
      alert(msg);
    } finally {
      setAsignando(false);
    }
  }, [orden, asignTecnicoSel, asignarTecnicoMutation]);

  // ───── Transition state ─────

  const [transitioningTarget, setTransitioningTarget] =
    useState<EstadoOrden | null>(null);
  // ───── Repuestos al avanzar Diagnóstico → Reparación ─────
  const [repuestosModalOpen, setRepuestosModalOpen] = useState(false);
  const [repuestosPendingReparacionId, setRepuestosPendingReparacionId] =
    useState<number | null>(null);
  const [repCompleteSearch, setRepCompleteSearch] = useState('');
  const [repCompleteSelectedIds, setRepCompleteSelectedIds] = useState<Set<number>>(new Set());
  const [repCompleteSubmitting, setRepCompleteSubmitting] = useState(false);

  const executeTransition = useCallback(
    async (target: EstadoOrden, descuentoDiagnostico?: boolean) => {
      if (!orden) return;
      setTransitioningTarget(target);
      try {
        await transitionMutation.mutateAsync({ id: orden.id, target, descuentoDiagnostico });
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

  const handleTransition = useCallback(
    async (target: EstadoOrden) => {
      if (!orden) return;
      // Intercept DIAGNOSTICO → REPARACION to ask about discount + parts
      if (orden.estado === EstadoOrden.DIAGNOSTICO && target === EstadoOrden.REPARACION) {
        // Find the "Revisión inicial" repair to pre-select its parts
        const revision = orden.reparaciones.find(
          (r) => r.descripcion === 'Revisión inicial',
        );
        if (revision) {
          setRepuestosPendingReparacionId(revision.id);
          const existingIds = new Set(
            (revision.repuestos ?? []).map((r) => r.repuestoId).filter((id): id is number => id != null),
          );
          setRepCompleteSelectedIds(existingIds);
        } else {
          setRepuestosPendingReparacionId(null);
          setRepCompleteSelectedIds(new Set());
        }
        setRepCompleteSearch('');
        setRepuestosModalOpen(true);
        return;
      }
      await executeTransition(target);
    },
    [orden, executeTransition],
  );

  // ───── Mutation: update repair parts ─────
  const updateRepuestosMutation = useMutation({
    mutationFn: ({
      ordenId: oId,
      reparacionId: rId,
      repuestoIds,
    }: {
      ordenId: number;
      reparacionId: number;
      repuestoIds: number[];
    }) => apiPut<Reparacion>(`/api/ordenes/${oId}/reparaciones/${rId}/repuestos`, repuestoIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes', ordenId] });
      queryClient.invalidateQueries({ queryKey: ['historial'] });
    },
  });

  const cancelTransition = useCallback(() => {
    setRepuestosModalOpen(false);
    setRepuestosPendingReparacionId(null);
    setRepCompleteSelectedIds(new Set());
    setRepCompleteSearch('');
    setRepCompleteDiscount(false);
  }, []);

  const [repCompleteDiscount, setRepCompleteDiscount] = useState(false);

  const confirmRepuestos = useCallback(async () => {
    if (!orden) return;
    setRepCompleteSubmitting(true);
    try {
      // Save parts to the "Revisión inicial" repair if one was found
      if (repuestosPendingReparacionId != null) {
        await updateRepuestosMutation.mutateAsync({
          ordenId: orden.id,
          reparacionId: repuestosPendingReparacionId,
          repuestoIds: Array.from(repCompleteSelectedIds),
        });
      }
      setRepuestosModalOpen(false);
      setRepuestosPendingReparacionId(null);
      setRepCompleteSelectedIds(new Set());
      setRepCompleteSearch('');
      setRepCompleteDiscount(false);
      // Now advance DIAGNOSTICO → REPARACION with discount flag
      await executeTransition(EstadoOrden.REPARACION, repCompleteDiscount);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al guardar repuestos';
      alert(msg);
    } finally {
      setRepCompleteSubmitting(false);
    }
  }, [orden, repuestosPendingReparacionId, repCompleteSelectedIds, repCompleteDiscount, updateRepuestosMutation, executeTransition]);

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
  const [selectedRepuestoIds, setSelectedRepuestoIds] = useState<Set<number>>(new Set());
  const [repuestoSearch, setRepuestoSearch] = useState('');

  // Tarifas para autocompletar el precio de una reparación según el equipo
  const { data: tarifas } = useTarifas();

  const tarifaAuto = useMemo(() => {
    if (repTipo === '') return undefined;
    const list = tarifas ?? [];
    const marcaIdEq = marcaId != null ? Number(marcaId) : null;
    const modeloIdEq = orden?.modeloId ?? null;
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
  }, [tarifas, repTipo, marcaId, orden?.modeloId]);

  const precioAutoHint = useMemo(() => {
    if (tarifaAuto) {
      return `Precio automático: ${formatCurrency(tarifaAuto.precio)} (tarifa)`;
    }
    return null;
  }, [tarifaAuto]);

  const filteredRepuestos = useMemo(() => {
    const term = repuestoSearch.trim().toLowerCase();
    if (!term) return repuestos;
    return repuestos.filter((r) => r.nombre.toLowerCase().includes(term));
  }, [repuestos, repuestoSearch]);

  const selectedRepuestos = useMemo(
    () => repuestos.filter((r) => selectedRepuestoIds.has(r.id)),
    [repuestos, selectedRepuestoIds],
  );

  const costoRepuestosPreview = useMemo(
    () => selectedRepuestos.reduce((sum, r) => sum + r.precioCosto, 0),
    [selectedRepuestos],
  );

  const precioFinalPreview = useMemo(() => {
    if (repPrecio !== '' && !isNaN(Number(repPrecio)) && Number(repPrecio) > 0) {
      return Number(repPrecio);
    }
    if (tarifaAuto) return tarifaAuto.precio;
    return null;
  }, [repPrecio, tarifaAuto]);

  const gananciaPreview = useMemo(() => {
    if (precioFinalPreview == null) return null;
    return precioFinalPreview - costoRepuestosPreview;
  }, [precioFinalPreview, costoRepuestosPreview]);

  const toggleRepuesto = useCallback((id: number) => {
    setSelectedRepuestoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Repuestos-complete modal: filtered list + preview
  const repCompleteFiltered = useMemo(() => {
    const term = repCompleteSearch.trim().toLowerCase();
    if (!term) return repuestos;
    return repuestos.filter((r) => r.nombre.toLowerCase().includes(term));
  }, [repuestos, repCompleteSearch]);

  const repCompleteSelected = useMemo(
    () => repuestos.filter((r) => repCompleteSelectedIds.has(r.id)),
    [repuestos, repCompleteSelectedIds],
  );

  const repCompleteCostoPreview = useMemo(
    () => repCompleteSelected.reduce((sum, r) => sum + r.precioCosto, 0),
    [repCompleteSelected],
  );

  const toggleRepComplete = useCallback((id: number) => {
    setRepCompleteSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openRepModal = useCallback(() => {
    setRepTipo('');
    setRepDescripcion('');
    setRepPrecio('');
    setRepErrors({});
    setSelectedRepuestoIds(new Set());
    setRepuestoSearch('');
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
        repuestoIds: Array.from(selectedRepuestoIds),
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
  }, [repTipo, repDescripcion, repPrecio, tarifaAuto, orden, closeRepModal, addReparacionMutation, selectedRepuestoIds]);

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
        key: 'repuestos',
        label: 'Repuestos',
        render: (row) =>
          row.repuestos && row.repuestos.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.repuestos.map((snapshot) => (
                <Badge key={snapshot.id}>
                  {snapshot.nombre} ({formatCurrency(snapshot.precioCosto)})
                </Badge>
              ))}
            </div>
          ) : (
            '—'
          ),
      },
      {
        key: 'precio',
        label: 'Precio',
        render: (row) => (
          <span
            className={
              orden?.descuentoDiagnostico &&
              row.descripcion === 'Revisión inicial'
                ? 'text-slate-400 line-through'
                : ''
            }
          >
            {formatCurrency(row.precio)}
            {orden?.descuentoDiagnostico &&
              row.descripcion === 'Revisión inicial' && (
                <span className="ml-1 text-xs text-amber-600">
                  (descontado)
                </span>
              )}
          </span>
        ),
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

  const transitionActions = orden
    ? (ESTADO_TRANSITIONS[orden.estado] ?? []).map((target) => ({
        target,
        label:
          TRANSITION_LABELS[`${orden.estado}:${target}`] ??
          estadoConfig[target].label,
        variant:
          TRANSITION_VARIANTS[`${orden.estado}:${target}`] ??
          ('primary' as const),
      }))
    : [];

  const totalReparaciones = useMemo(
    () =>
      orden?.reparaciones
        .filter(
          (r) =>
            !orden.descuentoDiagnostico ||
            r.descripcion !== 'Revisión inicial',
        )
        .reduce((sum, r) => sum + r.precio, 0) ?? 0,
    [orden],
  );

  const gananciaTotal = useMemo(() => {
    if (!orden) return null;
    const reparacionesConCosto = orden.reparaciones.filter(
      (r) =>
        r.ganancia != null &&
        (!orden.descuentoDiagnostico ||
          r.descripcion !== 'Revisión inicial'),
    );
    if (reparacionesConCosto.length === 0) return null;
    return reparacionesConCosto.reduce((sum, r) => sum + (r.ganancia ?? 0), 0);
  }, [orden]);

  const costoMateriales = useMemo(
    () =>
      orden?.reparaciones
        .filter(
          (r) =>
            !orden.descuentoDiagnostico ||
            r.descripcion !== 'Revisión inicial',
        )
        .reduce((sum, r) => sum + (r.costoRepuesto ?? 0), 0) ??
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

  if (error === 'FORBIDDEN') {
    return <Navigate to="/reparaciones" replace />;
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
              <span className="font-medium text-slate-700">Equipo:</span>{' '}
              {orden.tipo || orden.modeloId || orden.marcaId
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
          {canManageEntrega && (
            <Button variant="secondary" onClick={openEntregaModal}>
              Agendar Entrega
            </Button>
          )}
          {canViewOrden && cliente?.telefono && (
            <Button variant="secondary" onClick={handleReenviarAviso}>
              Enviar por WhatsApp
            </Button>
          )}
          {canViewOrden && (
            <Button variant="secondary" onClick={() => setTicketOpen(true)}>
              Ticket QR
            </Button>
          )}
          {canViewOrden && (
            <Button variant="secondary" onClick={() => setFacturaOpen(true)}>
              Factura
            </Button>
          )}
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

      {/* ── Técnico responsable ── */}
      <Card title="Técnico responsable">
        {tecnicoResponsable ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {tecnicoResponsable.nombre.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  {tecnicoResponsable.nombre}
                  {orden?.tecnicoId != null && orden.tecnicoId === user?.tecnicoId && (
                    <Badge variant="info">Tú</Badge>
                  )}
                </p>
                <p className="text-sm text-slate-500">
                  {tecnicoResponsable.correo ?? 'Sin correo registrado'}
                </p>
              </div>
            </div>
            {canEditOrden && (
              <div className="flex items-end gap-2">
                <div className="w-56">
                  <Select
                    label="Cambiar técnico"
                    options={tecnicoOptions}
                    placeholder="Sin asignar"
                    value={asignTecnicoSel}
                    onChange={(e) => setAsignTecnicoSel(e.target.value)}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void handleAsignarSelect()}
                  loading={asignando}
                >
                  Asignar
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Sin técnico asignado</p>
            {!esAdmin && user?.tecnicoId != null && (
              <Button
                variant="secondary"
                onClick={() => setConfirmAsignarme(true)}
                loading={asignando}
              >
                Asignarme
              </Button>
            )}
            {canEditOrden && (
              <div className="flex items-end gap-2">
                <div className="w-56">
                  <Select
                    label="Asignar técnico"
                    options={tecnicoOptions}
                    placeholder="Seleccionar..."
                    value={asignTecnicoSel}
                    onChange={(e) => setAsignTecnicoSel(e.target.value)}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void handleAsignarSelect()}
                  loading={asignando}
                >
                  Asignar
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Equipo Section ── */}
      <Card title="Equipo">
        <div className="space-y-4">
          <div>
            <span className="text-sm font-medium text-slate-700">Tipo:</span>
            <p className="mt-1 text-sm text-slate-600">
              {orden.tipo
                ? (tipoDispositivoLabel(orden.tipo) ?? orden.tipo)
                : '—'}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700">Marca:</span>
            <p className="mt-1 text-sm text-slate-600">
              {marcaNombre ?? (marcaId != null ? `Marca #${marcaId}` : '—')}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700">Modelo:</span>
            <p className="mt-1 text-sm text-slate-600">
              {modeloNombre ??
                (orden.modeloId != null ? `Modelo #${orden.modeloId}` : '—')}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700">
              Número de Serie:
            </span>
            <p className="mt-1 text-sm text-slate-600">
              {orden.numeroSerie ?? '—'}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700">IMEI:</span>
            <p className="mt-1 text-sm text-slate-600">
              {orden.imei ?? '—'}
            </p>
          </div>
          {orden.capacidad && (
            <div>
              <span className="text-sm font-medium text-slate-700">Capacidad:</span>
              <p className="mt-1 text-sm text-slate-600">{orden.capacidad}</p>
            </div>
          )}
          {orden.tipoGas && (
            <div>
              <span className="text-sm font-medium text-slate-700">Tipo de Gas:</span>
              <p className="mt-1 text-sm text-slate-600">{orden.tipoGas}</p>
            </div>
          )}
          {orden.voltaje && (
            <div>
              <span className="text-sm font-medium text-slate-700">Voltaje:</span>
              <p className="mt-1 text-sm text-slate-600">{orden.voltaje}</p>
            </div>
          )}
          {orden.notasTecnicas && (
            <div>
              <span className="text-sm font-medium text-slate-700">Notas Técnicas:</span>
              <p className="mt-1 text-sm text-slate-600">{orden.notasTecnicas}</p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Fotos del equipo ── */}
      <Card title="Fotos del equipo">
        {fotosLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : fotosError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Error al cargar las fotos: {fotosErrorMessage}
          </p>
        ) : (
          <div className="space-y-6">
            {ETAPAS_FOTO.map(({ etapa, titulo, descripcion }) => {
              const grupo = fotosPorEtapa[etapa];
              const preview = previews[etapa];
              const etapaHabilitada = orden
                ? puedeSubirFotoEtapa(etapa, orden.estado)
                : false;
              return (
                <div key={etapa}>
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {titulo}
                    </h4>
                    <p className="text-xs text-slate-500">{descripcion}</p>
                  </div>

                  {canManageFotos && !etapaHabilitada && (
                    <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Disponible cuando la orden esté en:{' '}
                      {[...FOTO_ETAPA_STATES[etapa]]
                        .map((e) => estadoConfig[e].label)
                        .join(', ')}
                    </p>
                  )}

                  {canManageFotos && etapaHabilitada && (
                    <div className="mb-4 space-y-2">
                      {preview ? (
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                          <img
                            src={preview}
                            alt="Vista previa"
                            className="h-16 w-16 shrink-0 rounded object-cover"
                          />
                          <div className="flex flex-1 items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleSubirFoto(etapa)}
                              loading={subiendoEtapa === etapa}
                            >
                              Subir
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => limpiarSeleccion(etapa)}
                              disabled={subiendoEtapa === etapa}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => fileInputRef.current[etapa]?.click()}
                        >
                          <Icon name="plus" size={16} /> Subir foto
                        </Button>
                      )}

                      <input
                        ref={(el) => {
                          fileInputRef.current[etapa] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          handleSeleccionarArchivo(etapa, e.target.files?.[0])
                        }
                      />

                      {uploadErrors[etapa] && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                          {uploadErrors[etapa]}
                        </p>
                      )}
                    </div>
                  )}

                  {grupo.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {grupo.map((foto) => (
                        <div key={foto.id} className="relative">
                          <img
                            src={foto.url}
                            alt={`Foto ${titulo.toLowerCase()}`}
                            className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                          />
                          {canManageFotos && etapaHabilitada && (
                            <button
                              type="button"
                              title="Eliminar foto"
                              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                              onClick={() => setFotoAEliminar(foto)}
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Sin fotos</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Workflow Section ── */}
      {canEditOrden && transitionActions.length > 0 && (
        <Card title="Flujo de Trabajo">
          <div className="flex flex-wrap gap-3">
            {transitionActions.map(({ target, label, variant }) => (
              <Button
                key={target}
                variant={variant}
                onClick={() => handleTransition(target)}
                loading={
                  transitioningTarget === target
                }
              >
                {label}
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
            {canManageReparaciones && (
              <Button variant="secondary" size="sm" onClick={openRepModal}>
                Agregar Reparación
              </Button>
            )}
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

      {/* ───── Diagnóstico → Reparación Modal ───── */}
      <Modal
        isOpen={repuestosModalOpen}
        onClose={cancelTransition}
        title="Diagnóstico → Reparación"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={cancelTransition}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={confirmRepuestos}
              loading={repCompleteSubmitting}
            >
              Iniciar Reparación
            </Button>
          </>
        }
      >
        {/* Discount question */}
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            ¿Desea descontar el diagnóstico del precio total?
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              checked={repCompleteDiscount}
              onChange={(e) => setRepCompleteDiscount(e.target.checked)}
            />
            <span className="text-sm text-amber-700">
              Sí, descontar diagnóstico (solo se cobra reparación + repuestos)
            </span>
          </label>
        </div>

        {/* Parts selector */}
        <p className="text-sm text-slate-600 mb-2">
          Seleccione los repuestos que necesita para esta reparación:
        </p>
        <Input
          type="text"
          placeholder="Buscar repuesto..."
          value={repCompleteSearch}
          onChange={(e) => setRepCompleteSearch(e.target.value)}
        />
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {repuestosPending ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : repCompleteFiltered.length === 0 ? (
            <p className="py-2 text-center text-sm text-slate-500">
              {repCompleteSearch.trim()
                ? 'No se encontraron repuestos'
                : 'No hay repuestos disponibles'}
            </p>
          ) : (
            <div className="space-y-1">
              {repCompleteFiltered.map((repuesto) => {
                const inputId = `rep-complete-${repuesto.id}`;
                const checked = repCompleteSelectedIds.has(repuesto.id);
                return (
                  <label
                    key={repuesto.id}
                    htmlFor={inputId}
                    className="flex cursor-pointer items-center gap-2 rounded-lg p-1 hover:bg-slate-50"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={checked}
                      onChange={() => toggleRepComplete(repuesto.id)}
                    />
                    <span className="flex-1 text-sm text-slate-700">
                      {repuesto.nombre}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatCurrency(repuesto.precioCosto)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-600">Costo de repuestos:</span>
          <span className="font-medium text-slate-800">
            {formatCurrency(repCompleteCostoPreview)}
          </span>
        </div>
      </Modal>

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

          <FormField label="Repuestos utilizados">
            <Input
              type="text"
              placeholder="Buscar repuesto..."
              value={repuestoSearch}
              onChange={(e) => setRepuestoSearch(e.target.value)}
            />
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {repuestosPending ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : filteredRepuestos.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">
                  {repuestoSearch.trim()
                    ? 'No se encontraron repuestos'
                    : 'No hay repuestos disponibles'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredRepuestos.map((repuesto) => {
                    const inputId = `repuesto-${repuesto.id}`;
                    const checked = selectedRepuestoIds.has(repuesto.id);
                    return (
                      <label
                        key={repuesto.id}
                        htmlFor={inputId}
                        className="flex cursor-pointer items-center gap-2 rounded-lg p-1 hover:bg-slate-50"
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={checked}
                          onChange={() => toggleRepuesto(repuesto.id)}
                        />
                        <span className="flex-1 text-sm text-slate-700">
                          {repuesto.nombre}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatCurrency(repuesto.precioCosto)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Costo de repuestos:</span>
                <span className="font-medium text-slate-800">
                  {formatCurrency(costoRepuestosPreview)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Ganancia estimada:</span>
                <span className="font-medium text-emerald-700">
                  {gananciaPreview != null
                    ? formatCurrency(gananciaPreview)
                    : '—'}
                </span>
              </div>
            </div>
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

      {/* ───── Factura Modal ───── */}
      <FacturaModal
        isOpen={facturaOpen}
        orden={orden}
        cliente={cliente ?? null}
        marca={marcaEquipo}
        modelo={modeloEquipo}
        onClose={() => setFacturaOpen(false)}
      />

      {/* ───── Confirmar Asignarme ───── */}
      <ConfirmDialog
        isOpen={confirmAsignarme}
        title="Asignar reparación"
        message={`¿Quieres asignarte la reparación #${orden.id}?`}
        confirmLabel="Asignarme"
        cancelLabel="Cancelar"
        variant="warning"
        loading={asignando}
        onConfirm={handleAsignarme}
        onCancel={() => setConfirmAsignarme(false)}
      />

      {/* ───── Confirmar Eliminar Foto ───── */}
      <ConfirmDialog
        isOpen={fotoAEliminar !== null}
        title="Eliminar foto"
        message="¿Seguro que quieres eliminar esta foto? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={eliminarFotoMutation.isPending}
        onConfirm={() => void handleEliminarFoto()}
        onCancel={() => setFotoAEliminar(null)}
      />
    </div>
  );
}
