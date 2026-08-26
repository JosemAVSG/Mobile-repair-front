import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { FormField } from '../components/molecules/FormField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { SearchField } from '../components/molecules/SearchField';
import { type Column } from '../components/organisms/DataTable';
import { EntityList } from '../components/organisms/EntityList';
import { apiPost, apiPut, apiDelete } from '../api/client';
import { formatDate, rolBadgeConfig } from '../utils/formatters';
import type { Tecnico, TecnicoRequest, RolUsuario } from '../types';
import { useTecnicos } from '../hooks/useQueries';
import { useAuth } from '../hooks/useAuth';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const ROL_OPTIONS: { value: RolUsuario; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'TECNICO', label: 'Técnico' },
];

interface FormErrors {
  nombre?: string;
  username?: string;
  password?: string;
  rol?: string;
  general?: string;
}

// ──────────────────────────────────────────────
// Tecnicos Page
// ──────────────────────────────────────────────

export function TecnicosPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const {
    data: tecnicos,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useTecnicos();

  const loading = isPending || isFetching;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const saveMutation = useMutation({
    mutationFn: (body: TecnicoRequest) =>
      editTarget
        ? apiPut<Tecnico>(`/api/tecnicos/${editTarget.id}`, body)
        : apiPost<Tecnico>('/api/tecnicos', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tecnicos'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete<unknown>(`/api/tecnicos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tecnicos'] }),
  });

  // Modal state (shared for create and edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tecnico | null>(null);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario | ''>('');
  const [activo, setActivo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Tecnico | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search state
  const [busqueda, setBusqueda] = useState('');

  // ───── Validation ─────

  const validate = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (!nombre.trim()) errors.nombre = 'El nombre es obligatorio';
    if (!username.trim()) errors.username = 'El username es obligatorio';
    if (!rol) errors.rol = 'Seleccione un rol';
    // La contraseña es obligatoria al crear; en edición puede dejarse vacía
    if (!editTarget && !password.trim()) {
      errors.password = 'La contraseña es obligatoria al crear';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [nombre, username, rol, password, editTarget]);

  // ───── Open create ─────

  const openCreate = useCallback(() => {
    setEditTarget(null);
    setNombre('');
    setCorreo('');
    setTelefono('');
    setUsername('');
    setPassword('');
    setRol('TECNICO');
    setActivo(true);
    setFieldErrors({});
    setModalOpen(true);
  }, []);

  // ───── Open edit ─────

  const openEdit = useCallback((tecnico: Tecnico) => {
    setEditTarget(tecnico);
    setNombre(tecnico.nombre);
    setCorreo(tecnico.correo ?? '');
    setTelefono(tecnico.telefono ?? '');
    setUsername(tecnico.username);
    setPassword('');
    setRol(tecnico.rol);
    setActivo(tecnico.activo);
    setFieldErrors({});
    setModalOpen(true);
  }, []);

  // ───── Close modal ─────

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditTarget(null);
    setNombre('');
    setCorreo('');
    setTelefono('');
    setUsername('');
    setPassword('');
    setRol('');
    setActivo(true);
    setFieldErrors({});
  }, []);

  // ───── Submit ─────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const body: TecnicoRequest = {
        nombre: nombre.trim(),
        correo: correo.trim() || undefined,
        telefono: telefono.trim() || undefined,
        username: username.trim(),
        rol: rol as RolUsuario,
        activo,
      };
      // En edición, contraseña vacía = no cambiar (el backend lo respeta).
      if (password.trim()) body.password = password.trim();

      await saveMutation.mutateAsync(body);
      closeModal();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al guardar técnico';
      setFieldErrors({ general: msg });
    } finally {
      setSubmitting(false);
    }
  }, [nombre, correo, telefono, username, password, rol, activo, validate, saveMutation, closeModal]);

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

  const columns: Column<Tecnico>[] = useMemo(
    () => [
      { key: 'nombre', label: 'Nombre', sortable: true },
      { key: 'username', label: 'Username', sortable: true },
      {
        key: 'rol',
        label: 'Rol',
        sortable: true,
        render: (row) => {
          const cfg = rolBadgeConfig(row.rol);
          return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
        },
      },
      {
        key: 'activo',
        label: 'Activo',
        sortable: true,
        render: (row) =>
          row.activo ? (
            <Badge variant="success">Activo</Badge>
          ) : (
            <Badge variant="danger">Inactivo</Badge>
          ),
      },
      {
        key: 'createdAt',
        label: 'Creado',
        sortable: true,
        render: (row) => (row.createdAt ? formatDate(row.createdAt) : '—'),
      },
      {
        key: 'id',
        label: 'Acciones',
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                openEdit(row);
              }}
            >
              Editar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
              disabled={currentUser?.id === row.id}
            >
              Eliminar
            </Button>
          </div>
        ),
      },
    ],
    [currentUser?.id, openEdit],
  );

  // ───── Render ─────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Técnicos</h2>
          <p className="text-sm text-slate-500">
            Gestión de usuarios y técnicos del taller
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="w-full sm:w-auto"
        >
          Nuevo Técnico
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-72">
          <SearchField
            placeholder="Buscar por nombre o username..."
            value={busqueda}
            onChange={setBusqueda}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar técnicos: {error}
            </p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Lista: cards en mobile, toggle Lista/Grilla en desktop */}
      {!error && (
        <EntityList<Tecnico>
          columns={columns}
          data={tecnicos ?? []}
          loading={loading}
          searchFilter={busqueda}
          emptyMessage="No hay técnicos registrados"
          keyExtractor={(row) => row.id}
          storageKey="vista-tecnicos"
          renderCard={(tecnico) => {
            const rolCfg = rolBadgeConfig(tecnico.rol);
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">
                      {tecnico.nombre}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      @{tecnico.username}
                    </p>
                  </div>
                  <Badge variant={rolCfg.variant}>{rolCfg.label}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {tecnico.activo ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="danger">Inactivo</Badge>
                  )}
                  <span className="text-xs text-slate-500">
                    {tecnico.createdAt ? formatDate(tecnico.createdAt) : '—'}
                  </span>
                </div>
                <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      openEdit(tecnico);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setDeleteTarget(tecnico);
                    }}
                    disabled={currentUser?.id === tecnico.id}
                  >
                    Eliminar
                  </Button>
                </div>
              </>
            );
          }}
        />
      )}

      {/* ───── Create/Edit Modal ───── */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Editar Técnico' : 'Nuevo Técnico'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {fieldErrors.general && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {fieldErrors.general}
            </p>
          )}

          <FormField label="Nombre" required error={fieldErrors.nombre}>
            <Input
              placeholder="Ej: Juan Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Correo">
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </FormField>

            <FormField label="Teléfono">
              <Input
                placeholder="+56 9 1234 5678"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Username" required error={fieldErrors.username}>
              <Input
                placeholder="usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </FormField>

            <FormField
              label="Contraseña"
              required={!editTarget}
              error={fieldErrors.password}
            >
              <Input
                type="password"
                placeholder={
                  editTarget
                    ? 'Nueva contraseña (dejar vacío para no cambiar)'
                    : 'Contraseña'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Rol" required error={fieldErrors.rol}>
              <Select
                options={ROL_OPTIONS}
                placeholder="Seleccionar rol..."
                value={rol}
                onChange={(e) => setRol(e.target.value as RolUsuario | '')}
              />
            </FormField>

            <FormField label="Activo">
              <label className="inline-flex cursor-pointer items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={activo}
                  onClick={() => setActivo((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    activo ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      activo ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-600">
                  {activo ? 'Habilitado' : 'Deshabilitado'}
                </span>
              </label>
            </FormField>
          </div>
        </div>
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar Técnico"
        message={`¿Estás seguro de eliminar al técnico "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
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