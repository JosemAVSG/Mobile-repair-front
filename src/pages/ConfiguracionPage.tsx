import { useState, useEffect, useRef } from 'react';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Icon } from '../components/atoms/Icon';
import { Spinner } from '../components/atoms/Spinner';
import { useConfig, DEFAULT_CONFIG } from '../context/ConfigContext';
import {
  useAdminShopConfig,
  useUpdateShopConfig,
} from '../hooks/useShopConfig';
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
    </div>
  );
}
