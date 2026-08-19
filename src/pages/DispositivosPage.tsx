import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/client';
import { formatDate, TIPO_DISPOSITIVO_LABELS } from '../utils/formatters';
import type { Dispositivo, DispositivoRequest, Modelo, Cliente, Marca } from '../types';
import { TipoDispositivo, CategoriaMarca } from '../types';

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

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const TIPO_OPTIONS = [
  { value: TipoDispositivo.CELULAR, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.CELULAR] },
  { value: TipoDispositivo.MICROONDAS, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.MICROONDAS] },
  { value: TipoDispositivo.NEVERA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.NEVERA] },
  { value: TipoDispositivo.COCINA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.COCINA] },
  { value: TipoDispositivo.LAVADORA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.LAVADORA] },
  { value: TipoDispositivo.COMPUTADORA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.COMPUTADORA] },
];

const tipoBadge: Record<TipoDispositivo, { label: string; variant: 'info' | 'warning' | 'default' }> = {
  [TipoDispositivo.CELULAR]: { label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.CELULAR], variant: 'info' },
  [TipoDispositivo.MICROONDAS]: { label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.MICROONDAS], variant: 'warning' },
  [TipoDispositivo.NEVERA]: { label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.NEVERA], variant: 'default' },
  [TipoDispositivo.COCINA]: { label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.COCINA], variant: 'warning' },
  [TipoDispositivo.LAVADORA]: { label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.LAVADORA], variant: 'info' },
  [TipoDispositivo.COMPUTADORA]: { label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.COMPUTADORA], variant: 'default' },
};

const LINEA_BLANCA_TIPOS = new Set([
  TipoDispositivo.MICROONDAS,
  TipoDispositivo.NEVERA,
  TipoDispositivo.COCINA,
  TipoDispositivo.LAVADORA,
]);

function buildMarcaCategoriaMap(marcas: Marca[]): Map<number, CategoriaMarca> {
  const map = new Map<number, CategoriaMarca>();
  for (const m of marcas) {
    map.set(m.id, m.categoria);
  }
  return map;
}

function categoriaDeTipo(tipo: TipoDispositivo): CategoriaMarca {
  switch (tipo) {
    case TipoDispositivo.CELULAR:
      return CategoriaMarca.CELULARES;
    case TipoDispositivo.COMPUTADORA:
      return CategoriaMarca.COMPUTADORAS;
    case TipoDispositivo.MICROONDAS:
    case TipoDispositivo.NEVERA:
    case TipoDispositivo.COCINA:
    case TipoDispositivo.LAVADORA:
      return CategoriaMarca.LINEA_BLANCA;
  }
}

function buildModeloMap(modelos: Modelo[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const m of modelos) {
    map.set(m.id, m.nombre);
  }
  return map;
}

function buildClienteMap(clientes: Cliente[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const c of clientes) {
    map.set(c.id, c.nombre);
  }
  return map;
}

function buildModeloOptions(modelos: Modelo[]): { value: string; label: string }[] {
  return modelos.map((m) => ({
    value: String(m.id),
    label: m.nombre,
  }));
}

function buildClienteOptions(clientes: Cliente[]): { value: string; label: string }[] {
  return clientes.map((c) => ({
    value: String(c.id),
    label: c.nombre,
  }));
}

// ──────────────────────────────────────────────
// Dispositivos Page
// ──────────────────────────────────────────────

export function DispositivosPage() {
  const [searchParams] = useSearchParams();
  const clienteIdFilter = searchParams.get('clienteId') ?? '';

  // Fetch dispositivos
  const queryClient = useQueryClient();

  const {
    data: dispositivos,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['dispositivos'],
    queryFn: () => apiGet<Dispositivo[]>('/api/dispositivos'),
  });

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  // Fetch modelos and clientes for enrichment and form selects
  const { data: modelos } = useQuery({
    queryKey: ['modelos'],
    queryFn: () => apiGet<Modelo[]>('/api/modelos'),
  });
  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => apiGet<Cliente[]>('/api/clientes'),
  });
  const { data: marcas } = useQuery({
    queryKey: ['marcas'],
    queryFn: () => apiGet<Marca[]>('/api/marcas'),
  });

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

  // ───── Derived ─────

  const isLineaBlanca = tipo !== '' && LINEA_BLANCA_TIPOS.has(tipo as TipoDispositivo);

  const marcaCategoriaMap = useMemo(
    () => buildMarcaCategoriaMap(marcas ?? []),
    [marcas],
  );

  const modeloOptions = useMemo(() => {
    const modelosList = modelos ?? [];
    const listaFiltrada =
      tipo !== ''
        ? modelosList.filter((m) => {
            const cat = marcaCategoriaMap.get(m.marcaId);
            return cat === categoriaDeTipo(tipo as TipoDispositivo);
          })
        : modelosList;
    return buildModeloOptions(listaFiltrada);
  }, [modelos, tipo, marcaCategoriaMap]);

  const clienteOptions = useMemo(() => buildClienteOptions(clientes ?? []), [clientes]);

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
        const cfg = tipoBadge[row.tipo];
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
      <div className="flex gap-4">
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
          emptyMessage="No hay dispositivos registrados"
          keyExtractor={(row) => row.id}
        />
      )}

      {/* ───── Create / Edit Modal ───── */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Editar Dispositivo' : 'Nuevo Dispositivo'}
        size="lg"
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
          <FormField label="Tipo" required error={fieldErrors.tipo}>
            <Select
              options={TIPO_OPTIONS}
              placeholder="Seleccionar tipo..."
              value={tipo}
              onChange={(e) => {
                const newTipo = e.target.value as TipoDispositivo | '';
                setTipo(newTipo);
                setModeloId('');
                // Reset conditional fields when tipo changes
                setNumeroSerie('');
                setImei('');
                setCapacidad('');
                setTipoGas('');
                setVoltaje('');
                setNotasTecnicas('');
              }}
            />
          </FormField>

          <FormField label="Modelo" required error={fieldErrors.modeloId}>
            <Select
              options={modeloOptions}
              placeholder="Seleccionar modelo..."
              value={modeloId}
              onChange={(e) => setModeloId(e.target.value)}
            />
          </FormField>

          <FormField label="Cliente" required error={fieldErrors.clienteId}>
            <Select
              options={clienteOptions}
              placeholder="Seleccionar cliente..."
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            />
          </FormField>

          {/* Conditional fields for CELULAR */}
          {tipo === TipoDispositivo.CELULAR && (
            <>
              <FormField label="Número de Serie">
                <Input
                  placeholder="Número de serie"
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                />
              </FormField>

              <FormField label="IMEI">
                <Input
                  placeholder="IMEI del dispositivo"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                />
              </FormField>

              <FormField label="Notas Técnicas">
                <textarea
                  className="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                  placeholder="Notas técnicas del dispositivo"
                  value={notasTecnicas}
                  onChange={(e) => setNotasTecnicas(e.target.value)}
                />
              </FormField>
            </>
          )}

          {/* Conditional fields for COMPUTADORA */}
          {tipo === TipoDispositivo.COMPUTADORA && (
            <>
              <FormField label="Número de Serie">
                <Input
                  placeholder="Número de serie"
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                />
              </FormField>

              <FormField label="Notas Técnicas">
                <textarea
                  className="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                  placeholder="Notas técnicas del dispositivo"
                  value={notasTecnicas}
                  onChange={(e) => setNotasTecnicas(e.target.value)}
                />
              </FormField>
            </>
          )}

          {/* Conditional fields for Línea Blanca */}
          {isLineaBlanca && (
            <>
              <FormField label="Número de Serie">
                <Input
                  placeholder="Número de serie"
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                />
              </FormField>

              <FormField label="Capacidad">
                <Input
                  placeholder="Ej: 300L, 20kg"
                  value={capacidad}
                  onChange={(e) => setCapacidad(e.target.value)}
                />
              </FormField>

              <FormField label="Tipo Gas">
                <Input
                  placeholder="Ej: R134a"
                  value={tipoGas}
                  onChange={(e) => setTipoGas(e.target.value)}
                />
              </FormField>

              <FormField label="Voltaje">
                <Input
                  placeholder="Ej: 220V"
                  value={voltaje}
                  onChange={(e) => setVoltaje(e.target.value)}
                />
              </FormField>

              <FormField label="Notas Técnicas">
                <textarea
                  className="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                  placeholder="Notas técnicas del dispositivo"
                  value={notasTecnicas}
                  onChange={(e) => setNotasTecnicas(e.target.value)}
                />
              </FormField>
            </>
          )}
        </div>
      </Modal>

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
