import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  type ReactNode,
} from 'react';

// ──────────────────────────────────────────────
// Configuración del taller
// ──────────────────────────────────────────────
//
// TODO(migración backend): `nombreTaller` y `logo` deben migrarse a un
// endpoint de configuración del backend (GET/PUT /api/configuracion). Los
// colores/tema (`colorPrimario`) permanecen SIEMPRE en localStorage, ya que
// son una preferencia visual local del dispositivo y no necesitan
// sincronización entre usuarios.
//
// Por ahora todo se persiste en localStorage bajo la clave `taller-config`.

export interface TallerConfig {
  nombreTaller: string;
  logo: string | null;
  colorPrimario: string;
}

export const DEFAULT_CONFIG: TallerConfig = {
  nombreTaller: 'Taller de Reparaciones',
  logo: null,
  colorPrimario: '#2563eb',
};

interface ConfigContextType {
  config: TallerConfig;
  updateConfig: (parcial: Partial<TallerConfig>) => void;
}

export const ConfigContext = createContext<ConfigContextType | null>(null);

const STORAGE_KEY = 'taller-config';

// Variables CSS que consume Tailwind v4 (@theme inline en index.css)
const CSS_PRIMARY = '--taller-primary';
const CSS_PRIMARY_DARK = '--taller-primary-dark';

/**
 * Oscurece (percent negativo) o aclara (percent positivo) un color hex.
 * Devuelve el color en formato #rrggbb.
 */
function shadeColor(hex: string, percent: number): string {
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '#1d4ed8';
  const num = parseInt(normalized, 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0x00ff) + amt);
  const b = clamp((num & 0x0000ff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Aplica los colores del taller como variables CSS en el documento. */
function applyConfigTheme(config: TallerConfig): void {
  const root = document.documentElement;
  root.style.setProperty(CSS_PRIMARY, config.colorPrimario);
  root.style.setProperty(CSS_PRIMARY_DARK, shadeColor(config.colorPrimario, -15));
}

function loadFromStorage(): TallerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<TallerConfig>;
    return {
      nombreTaller:
        typeof parsed.nombreTaller === 'string' && parsed.nombreTaller.trim() !== ''
          ? parsed.nombreTaller
          : DEFAULT_CONFIG.nombreTaller,
      logo: typeof parsed.logo === 'string' ? parsed.logo : DEFAULT_CONFIG.logo,
      colorPrimario:
        typeof parsed.colorPrimario === 'string' && parsed.colorPrimario.trim() !== ''
          ? parsed.colorPrimario
          : DEFAULT_CONFIG.colorPrimario,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [config, setConfig] = useState<TallerConfig>(() => loadFromStorage());

  // Aplica el color primario en runtime cada vez que cambia
  useEffect(() => {
    applyConfigTheme(config);
  }, [config.colorPrimario]);

  // Mantiene el título del documento sincronizado con el nombre del taller
  useEffect(() => {
    document.title = config.nombreTaller || DEFAULT_CONFIG.nombreTaller;
  }, [config.nombreTaller]);

  const updateConfig = useCallback((parcial: Partial<TallerConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...parcial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        // Puede fallar si el logo (data URL) excede la cuota de localStorage
        console.warn('No se pudo persistir la configuración del taller', err);
      }
      return next;
    });
  }, []);

  return (
    <ConfigContext.Provider value={{ config, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextType {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfig debe usarse dentro de ConfigProvider');
  }
  return ctx;
}