import { useState, useEffect, useRef } from 'react';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Icon } from '../components/atoms/Icon';
import { Spinner } from '../components/atoms/Spinner';
import { Badge } from '../components/atoms/Badge';
import { useConfig, DEFAULT_CONFIG } from '../context/ConfigContext';
import {
  useAdminShopConfig,
  useUpdateShopConfig,
} from '../hooks/useShopConfig';
import { useSuscripcion, useCreateCheckout, usePortalLink } from '../hooks/useBilling';
import { formatCop, formatDate } from '../utils/formatters';
import { ApiError } from '../api/ApiClient';
import type { ShopConfigForm } from '../types';

// ──────────────────────────────────────────────
// Presets de color
// ──────────────────────────────────────────────

const PRESETS: { nombre: string; color: string }[] = [
  { nombre: 'Azul', color: '#2563eb' },
  { nombre: 'Esmeralda', color: '#10b981' },
  { nombre: 'Violeta', color: '#7c3aed' },
  { nombre: 'Naranja', color: '#f97316' },
];

const MAX_LOGO_SIZE_MB = 2;

// ──────────────────────────────────────────────
// ConfiguracionPage
// ──────────────────────────────────────────────

export function ConfiguracionPage() {
  const { config, updateConfig } = useConfig();
  const { data: backendConfig, isPending: loadingBackend } = useAdminShopConfig();
  const updateMutation = useUpdateShopConfig();

  const [draft, setDraft] = useState<ShopConfigForm>({
    nombreTaller: '',
    logo: null,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Sincroniza el draft con la configuración del backend.
  useEffect(() => {
    if (backendConfig) {
      setDraft(backendConfig);
      setPreviewUrl(backendConfig.logo);
    }
  }, [backendConfig]);

  // Limpia object URLs creadas para previsualizar archivos locales.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleNombreChange = (value: string) => {
    setDraft((prev) => ({ ...prev, nombreTaller: value }));
  };

  const handleLogoFile = (file?: File) => {
    setLogoError(null);
    if (!file) return;

    if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
      setLogoError(`El logo no puede superar los ${MAX_LOGO_SIZE_MB} MB.`);
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    setDraft((prev) => ({ ...prev, logo: file }));
  };

  const handleRemoveLogo = () => {
    setLogoError(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
    setDraft((prev) => ({ ...prev, logo: null }));
  };

  const handleGuardar = () => {
    setLogoError(null);
    updateMutation.mutate(draft);
  };

  const handleRestablecerColores = () => {
    updateConfig({ colorPrimario: DEFAULT_CONFIG.colorPrimario });
  };

  const colorSeleccionado = (color: string) =>
    config.colorPrimario.toLowerCase() === color.toLowerCase();

  const handleColorChange = (color: string) => {
    updateConfig({ colorPrimario: color });
  };

  const isLoading = loadingBackend;
  const isSaving = updateMutation.isPending;
  const saveError = updateMutation.error
    ? updateMutation.error instanceof Error
      ? updateMutation.error.message
      : 'Error al guardar la configuración'
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Configuración</h2>
        <p className="text-sm text-slate-500">
          Personaliza la identidad visual del taller
        </p>
      </div>

      {/* ── Identidad del taller (backend) ── */}
      <Card title="Identidad del taller">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                Nombre del taller
              </p>
              <Input
                placeholder="Taller de Reparaciones"
                value={draft.nombreTaller}
                onChange={(e) => handleNombreChange(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Se muestra en el menú lateral, el encabezado, la factura y los
                mensajes de WhatsApp.
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Logo</p>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Logo del taller"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Icon
                      name="smartphone"
                      size={32}
                      className="text-slate-400"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                    Subir logo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleLogoFile(e.target.files?.[0])}
                    />
                  </label>
                  {previewUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                    >
                      Quitar logo
                    </Button>
                  )}
                </div>
              </div>
              {logoError && (
                <p className="mt-2 text-sm text-red-600">{logoError}</p>
              )}
            </div>

            {saveError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {saveError}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleGuardar} loading={isSaving}>
                Guardar cambios
              </Button>
              {updateMutation.isSuccess && (
                <span className="text-sm font-medium text-emerald-600">
                  Cambios guardados
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Colores (local) ── */}
      <Card title="Colores">
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Colores predefinidos
            </p>
            <div className="flex flex-wrap gap-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => handleColorChange(preset.color)}
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                    colorSeleccionado(preset.color)
                      ? 'ring-2 ring-slate-400 ring-offset-2'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.nombre}
                  aria-label={`Color ${preset.nombre}`}
                >
                  {colorSeleccionado(preset.color) && (
                    <Icon
                      name="check-circle"
                      size={18}
                      className="text-white"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Color personalizado
            </p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.colorPrimario}
                onChange={(e) => handleColorChange(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                aria-label="Color personalizado"
              />
              <span className="font-mono text-sm text-slate-600">
                {config.colorPrimario}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Vista previa
            </p>
            <div className="flex items-center gap-3">
              <Button>Botón primario</Button>
              <span className="text-sm text-slate-500">
                El color se aplica en tiempo real a botones y menú.
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Acciones ── */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={handleRestablecerColores}>
          Restablecer colores
        </Button>
        <span className="text-xs text-slate-500">
          Restablecer solo afecta el color local; no modifica el nombre ni el
          logo del taller.
        </span>
      </div>
      <SuscripcionSection />
    </div>
  );
}

const DAY_MS = 86_400_000;

const ESTADO_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  ACTIVO: 'success',
  TRIAL: 'info',
  SUSPENDIDO: 'warning',
  CANCELADO: 'danger',
};

const ESTADO_LABEL: Record<string, string> = {
  ACTIVO: 'Activo',
  TRIAL: 'Prueba gratuita',
  SUSPENDIDO: 'Suspendido',
  CANCELADO: 'Cancelado',
};

const ESTADO_COPY: Record<string, string> = {
  SUSPENDIDO: 'Tu suscripción está suspendida. Renueva tu plan para continuar.',
  CANCELADO: 'Tu suscripción fue cancelada. Elige un plan para reactivar tu taller.',
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'No se pudo completar la operación';
}

/** Días enteros que faltan hasta `iso` (mínimo 0), o null si la fecha no es válida. */
function daysLeft(iso: string): number | null {
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / DAY_MS));
}

function SuscripcionSection() {
  const { data: suscripcion, isLoading } = useSuscripcion();
  const createCheckout = useCreateCheckout();
  const createPortal = usePortalLink();
  const contactEmail = (import.meta.env.VITE_BILLING_CONTACT_EMAIL as string | undefined) || '';

  const redirect = (url: string) => window.location.assign(url);
  const handleCheckout = (plan?: 'BASICO' | 'PRO') => {
    createPortal.reset();
    createCheckout.mutate(plan, { onSuccess: redirect });
  };
  const handlePortal = () => {
    createCheckout.reset();
    createPortal.mutate(undefined, { onSuccess: redirect });
  };

  let body;
  if (isLoading) {
    body = (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  } else if (!suscripcion) {
    body = (
      <p className="text-sm text-slate-600">No hay información de suscripción disponible.</p>
    );
  } else {
    const { plan, planDisplayName, estado, precioCop, features, trialEndsAt, currentPeriodEnd } =
      suscripcion;
    const isLegacy = plan === 'LEGACY';
    const isEmpresarial = plan === 'EMPRESARIAL' || suscripcion.contactoEmpresarial;
    const blocked = estado === 'SUSPENDIDO' || estado === 'CANCELADO';
    const trialDays = plan === 'TRIAL' && trialEndsAt ? daysLeft(trialEndsAt) : null;
    const pending = createCheckout.isPending || createPortal.isPending;
    const actionError = createCheckout.error ?? createPortal.error;

    // Elegir plan: TRIAL o estados bloqueados (renovar/reactivar). Mejorar: BASICO activo.
    const showChoosePlan = !isLegacy && !isEmpresarial && (plan === 'TRIAL' || blocked);
    const showUpgrade = !isLegacy && !isEmpresarial && !blocked && plan === 'BASICO';
    // El portal solo sirve con cliente en el proveedor; la API no lo expone, así que
    // se ofrece y el error 400/409 del backend se muestra si todavía no existe.
    const showPortal =
      !isLegacy && !isEmpresarial && (blocked || plan === 'BASICO' || plan === 'PRO');

    body = (
      <div className="space-y-4">
        <div>
          <h4 className="text-lg font-semibold text-slate-800">{planDisplayName}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {isLegacy ? (
              <Badge variant="default">Plan heredado</Badge>
            ) : (
              <Badge variant={ESTADO_BADGE[estado] ?? 'default'}>
                {ESTADO_LABEL[estado] ?? estado}
              </Badge>
            )}
          </div>
          {precioCop != null && (
            <p className="mt-2 text-sm font-medium text-slate-700">{formatCop(precioCop)}</p>
          )}
          {trialDays != null && (
            <p className="mt-2 text-sm text-slate-600">
              {trialDays === 1 ? 'Te queda 1 día' : `Te quedan ${trialDays} días`} de prueba
              {trialEndsAt ? ` (hasta el ${formatDate(trialEndsAt)})` : ''}.
            </p>
          )}
          {currentPeriodEnd && !isLegacy && (
            <p className="mt-2 text-sm text-slate-600">
              Período vigente hasta el {formatDate(currentPeriodEnd)}.
            </p>
          )}
        </div>

        {blocked && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {ESTADO_COPY[estado]}
          </p>
        )}

        {features && features.length > 0 && (
          <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            <p className="mb-1 font-medium text-slate-700">Incluye</p>
            <ul className="list-inside list-disc space-y-0.5">
              {features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {showChoosePlan && (
            <>
              <Button type="button" disabled={pending} onClick={() => handleCheckout('BASICO')}>
                Elegir plan Básico
              </Button>
              <Button type="button" disabled={pending} onClick={() => handleCheckout('PRO')}>
                Elegir plan Pro
              </Button>
            </>
          )}
          {showUpgrade && (
            <Button type="button" disabled={pending} onClick={() => handleCheckout('PRO')}>
              Mejorar plan (Pro)
            </Button>
          )}
          {showPortal && (
            <Button type="button" variant="secondary" disabled={pending} onClick={handlePortal}>
              Gestionar suscripción
            </Button>
          )}
          {isEmpresarial &&
            (contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Contactar
              </a>
            ) : (
              <span className="text-sm text-slate-500">
                Contacta a ventas para gestionar tu plan.
              </span>
            ))}
        </div>

        {actionError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage(actionError)}
          </p>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Suscripción">
      <Card title="Suscripción">{body}</Card>
    </section>
  );
}
