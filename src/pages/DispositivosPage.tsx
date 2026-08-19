import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Select } from '../components/atoms/Select';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { SearchField } from '../components/molecules/SearchField';
import { DispositivoForm } from '../components/molecules/DispositivoForm';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { apiPost, apiPut, apiDelete } from '../api/client';
import { formatDate, tipoBadgeConfig, TIPO_DISPOSITIVO_LABELS } from '../utils/formatters';
import { buildModeloMap, buildClienteMap, buildClienteOptions } from '../utils/maps';
import type { Dispositivo, DispositivoRequest } from '../types';
import { TipoDispositivo } from '../types';
import { useMarcas, useModelos, useClientes, useDispositivos } from '../hooks/useQueries';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface DispositivoRow {
  id: number;
  tipo: TipoDispositivo;
  modeloNombre: string;
  clienteNombre: string;
  identificador: string;
  createdAt: string;
}

const TIPO_OPTIONS = [
  { value: TipoDispositivo.CELULAR, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.CELULAR] },
  { value: TipoDispositivo.MICROONDAS, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.MICROONDAS] },
  { value: TipoDispositivo.NEVERA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.NEVERA] },
  { value: TipoDispositivo.COCINA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.COCINA] },
  { value: TipoDispositivo.LAVADORA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.LAVADORA] },
  { value: TipoDispositivo.COMPUTADORA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.COMPUTADORA] },
];

// ──────────────────────────────────────────────
// Dispositivos Page
// ──────────────────────────────────────────────

export function DispositivosPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clienteIdFilter = searchParams.get('clienteId') ?? '';

  // Fetch dispositivos
  const queryClient = useQueryClient();

  const {
    data: dispositivos,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useDispositivos();

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  // Fetch modelos and clientes for enrichment and form selects
  const { data: modelos } = useModelos();
  const { data: clientes } = useClientes();
  const { data: marcas } = useMarcas();

  const saveMutation = useMutation({
    mutationFn: (body: DispositivoRequest) =>
      editTarget
        ? apiPut<Dispositivo>(`/api/dispositivos/${editTarget.id}`, body)
        : apiPost<Dispositivo>('/api/dispositivos', body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['dispositivos'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete<unknown>(`/api/dispositivos/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['dispositivos'] }),
  });

  // Filter state
  const [filtroCliente, setFiltroCliente] = useState(clienteIdFilter);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Modal state (shared for create and edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Dispositivo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form fields
  const [tipo, setTipo] = useState<TipoDispositivo | ''>('');
  const [modeloId, setModeloId] = useState('');
  const [clienteId, setClienteId] = useState(clienteIdFilter);
  const [numeroSerie, setNumeroSerie] = useState('');
  const [imei, setImei] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [tipoGas, setTipoGas] = useState('');
  const [voltaje, setVoltaje] = useState('');
  const [notasTecnicas, setNotasTecnicas] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Dispositivo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const clienteOptions = useMemo(
    () => buildClienteOptions(clientes ?? []),
    [clientes],
  );

  // Enriched rows
  const modeloMap = useMemo(() => buildModeloMap(modelos ?? []), [modelos]);
  const clienteMap = useMemo(() => buildClienteMap(clientes ?? []), [clientes]);

  const rows = useMemo<DispositivoRow[]>(() => {
    const list = dispositivos ?? [];
    let filtered = filtroCliente
      ? list.filter((d) => String(d.clienteId) === filtroCliente)
      : list;
    if (filtroTipo) {
      filtered = filtered.filter((d) => d.tipo === (filtroTipo as TipoDispositivo));
    }

    return filtered.map((d) => ({
      id: d.id,
      tipo: d.tipo,
      modeloNombre: modeloMap.get(d.modeloId) ?? `Modelo #${d.modeloId}`,
      clienteNombre: clienteMap.get(d.clienteId) ?? `Cliente #${d.clienteId}`,
      identificador: d.imei ?? d.numeroSerie ?? '—',
      createdAt: d.createdAt,
    }));
  }, [dispositivos, filtroCliente, filtroTipo, modeloMap, clienteMap]);

  // ───── Validation ─────

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!tipo) errors.tipo = 'El tipo es obligatorio';
    if (!modeloId) errors.modeloId = 'El modelo es obligatorio';
    if (!clienteId) errors.clienteId = 'El cliente es obligatorio';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [tipo, modeloId, clienteId]);

  // ───── Open create ─────

  const openCreate = useCallback(() => {
    setEditTarget(null);
    setTipo('');
    setModeloId('');
    setClienteId(clienteIdFilter);
    setNumeroSerie('');
    setImei('');
    setCapacidad('');
    setTipoGas('');
    setVoltaje('');
    setNotasTecnicas('');
    setFieldErrors({});
    setModalOpen(true);
  }, [clienteIdFilter]);

  // ───── Open edit ─────

  const openEdit = useCallback((dispositivo: Dispositivo) => {
    setEditTarget(dispositivo);
    setTipo(dispositivo.tipo);
    setModeloId(String(dispositivo.modeloId));
    setClienteId(String(dispositivo.clienteId));
    setNumeroSerie(dispositivo.numeroSerie ?? '');
    setImei(dispositivo.imei ?? '');
    setCapacidad(dispositivo.capacidad ?? '');
    setTipoGas(dispositivo.tipoGas ?? '');
    setVoltaje(dispositivo.voltaje ?? '');
    setNotasTecnicas(dispositivo.notasTecnicas ?? '');
    setFieldErrors({});
    setModalOpen(true);
  }, []);

  // ───── Close modal ─────

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditTarget(null);
    setTipo('');
    setModeloId('');
    setClienteId(clienteIdFilter);
    setNumeroSerie('');
    setImei('');
    setCapacidad('');
    setTipoGas('');
    setVoltaje('');
    setNotasTecnicas('');
    setFieldErrors({});
  }, [clienteIdFilter]);

  // ───── Submit ─────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const body: DispositivoRequest = {
        tipo: tipo as TipoDispositivo,
        modeloId: Number(modeloId),
        clienteId: Number(clienteId),
        numeroSerie: numeroSerie.trim() || undefined,
        imei: imei.trim() || undefined,
        capacidad: capacidad.trim() || undefined,
        tipoGas: tipoGas.trim() || undefined,
        voltaje: voltaje.trim() || undefined,
        notasTecnicas: notasTecnicas.trim() || undefined,
      };
      await saveMutation.mutateAsync(body);
      closeModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar dispositivo';
      setFieldErrors({ general: msg });
    } finally {
      setSubmitting(false);
    }
  }, [
    tipo, modeloId, clienteId, numeroSerie, imei,
    capacidad, tipoGas, voltaje, notasTecnicas,
    validate, saveMutation, closeModal,
  ]);

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

  // ───── Columns ─────

  const columns: Column<DispositivoRow>[] = [
    {
      key: 'tipo',
      label: 'Tipo',
      sortable: true,
      render: (row) => {
        const cfg = tipoBadgeConfig(row.tipo);
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    { key: 'modeloNombre', label: 'Modelo', sortable: true },
    { key: 'clienteNombre', label: 'Cliente', sortable: true },
    {
      key: 'identificador',
      label: 'Número de Serie / IMEI',
      render: (row) => row.identificador,
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
            variant="primary"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              const disp = (dispositivos ?? []).find((d) => d.id === row.id);
              const clienteId = disp?.clienteId ?? '';
              navigate(
                `/ordenes?dispositivoId=${row.id}&clienteId=${clienteId}`,
              );
            }}
          >
            Crear Orden
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              const target = (dispositivos ?? []).find((d) => d.id === row.id);
              if (target) openEdit(target);
            }}
          >
            Editar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              const target = (dispositivos ?? []).find((d) => d.id === row.id);
              if (target) setDeleteTarget(target);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dispositivos</h2>
          <p className="text-sm text-slate-500">Gestión de dispositivos</p>
        </div>
        <Button onClick={openCreate}>Nuevo Dispositivo</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <SearchField
            placeholder="Buscar dispositivo..."
            value={busqueda}
            onChange={setBusqueda}
          />
        </div>
        <div className="max-w-xs">
          <Select
            label="Filtrar por Cliente"
            options={clienteOptions}
            placeholder="Todos los clientes"
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
          />
        </div>
        <div className="max-w-xs">
          <Select
            label="Filtrar por Tipo"
            options={TIPO_OPTIONS}
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
              Error al cargar dispositivos: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Data table */}
      {!error && (
        <DataTable<DispositivoRow>
          columns={columns}
          data={rows}
          loading={loading}
          searchFilter={busqueda}
          emptyMessage="No hay dispositivos registrados"
          keyExtractor={(row) => row.id}
        />
      )}

      {/* ───── Create / Edit Modal ───── */}
      <DispositivoForm
        open={modalOpen}
        title={editTarget ? 'Editar Dispositivo' : 'Nuevo Dispositivo'}
        isEdit={editTarget !== null}
        submitting={submitting}
        tipo={tipo}
        setTipo={setTipo}
        modeloId={modeloId}
        setModeloId={setModeloId}
        clienteId={clienteId}
        setClienteId={setClienteId}
        numeroSerie={numeroSerie}
        setNumeroSerie={setNumeroSerie}
        imei={imei}
        setImei={setImei}
        capacidad={capacidad}
        setCapacidad={setCapacidad}
        tipoGas={tipoGas}
        setTipoGas={setTipoGas}
        voltaje={voltaje}
        setVoltaje={setVoltaje}
        notasTecnicas={notasTecnicas}
        setNotasTecnicas={setNotasTecnicas}
        fieldErrors={fieldErrors}
        clientes={clientes}
        modelos={modelos}
        marcas={marcas}
        onCancel={closeModal}
        onSubmit={handleSubmit}
      />

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar Dispositivo"
        message={`¿Estás seguro de eliminar este dispositivo? Esta acción no se puede deshacer.`}
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
