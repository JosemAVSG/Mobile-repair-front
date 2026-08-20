import { useState } from 'react';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Icon } from '../components/atoms/Icon';
import {
  useConfig,
  DEFAULT_CONFIG,
  type TallerConfig,
} from '../context/ConfigContext';

// ──────────────────────────────────────────────
// Presets de color
// ──────────────────────────────────────────────

const PRESETS: { nombre: string; color: string }[] = [
  { nombre: 'Azul', color: '#2563eb' },
  { nombre: 'Esmeralda', color: '#10b981' },
  { nombre: 'Violeta', color: '#7c3aed' },
  { nombre: 'Naranja', color: '#f97316' },
];

// ──────────────────────────────────────────────
// ConfiguracionPage
// ──────────────────────────────────────────────

export function ConfiguracionPage() {
  const { config, updateConfig } = useConfig();
  const [draft, setDraft] = useState<TallerConfig>(config);
  const [guardado, setGuardado] = useState(false);

  const handleNombreChange = (value: string) => {
    setDraft((prev) => ({ ...prev, nombreTaller: value }));
  };

  const handleLogoFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((prev) => ({ ...prev, logo: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const handleGuardar = () => {
    updateConfig(draft);
    setGuardado(true);
    window.setTimeout(() => setGuardado(false), 2500);
  };

  const handleRestablecer = () => {
    setDraft(DEFAULT_CONFIG);
    updateConfig(DEFAULT_CONFIG);
    setGuardado(false);
  };

  const colorSeleccionado = (color: string) =>
    draft.colorPrimario.toLowerCase() === color.toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Configuración</h2>
        <p className="text-sm text-slate-500">
          Personaliza la identidad visual del taller
        </p>
      </div>

      {/* ── Identidad del taller ── */}
      <Card title="Identidad del taller">
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
                {draft.logo ? (
                  <img
                    src={draft.logo}
                    alt="Logo del taller"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Icon name="smartphone" size={32} className="text-slate-400" />
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
                {draft.logo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft((prev) => ({ ...prev, logo: null }))}
                  >
                    Quitar logo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Colores ── */}
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
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      colorPrimario: preset.color,
                    }))
                  }
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
                    <Icon name="check-circle" size={18} className="text-white" />
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
                value={draft.colorPrimario}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, colorPrimario: e.target.value }))
                }
                className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                aria-label="Color personalizado"
              />
              <span className="font-mono text-sm text-slate-600">
                {draft.colorPrimario}
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
        <Button onClick={handleGuardar}>Guardar cambios</Button>
        <Button variant="secondary" onClick={handleRestablecer}>
          Restablecer valores
        </Button>
        {guardado && (
          <span className="text-sm font-medium text-emerald-600">
            Cambios guardados
          </span>
        )}
      </div>
    </div>
  );
}