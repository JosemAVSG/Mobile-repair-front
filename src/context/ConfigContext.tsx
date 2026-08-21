import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';
import type { BackendShopConfig } from '../types';

// ──────────────────────────────────────────────
// Configuración del taller
// ──────────────────────────────────────────────
//
// `colorPrimario` es una preferencia visual local del dispositivo: se guarda
// SIEMPRE en localStorage y NUNCA se envía al backend.
//
// `nombreTaller` y `logo` son identidad del taller: se leen desde el endpoint
// público `/api/configuracion/public`. Se conserva una única lectura del
// legacy `taller-config` localStorage como fallback hasta que el backend
// responda.

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
  /** Actualiza preferencias locales (solo `colorPrimario` se persiste). */
  updateConfig: (parcial: Partial<TallerConfig>) => void;
}

export const ConfigContext = createContext<ConfigContextType | null>(null);

const STORAGE_KEY = 'taller-config';
const QUERY_KEY = ['configuracion', 'public'];

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
function applyConfigTheme(colorPrimario: string): void {
  const root = document.documentElement;
  root.style.setProperty(CSS_PRIMARY, colorPrimario);
  root.style.setProperty(CSS_PRIMARY_DARK, shadeColor(colorPrimario, -15));
}

/** Lee únicamente el color primario de localStorage. */
function loadColorFromStorage(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG.colorPrimario;
    const parsed = JSON.parse(raw) as Partial<TallerConfig>;
    return (
      typeof parsed.colorPrimario === 'string' &&
      parsed.colorPrimario.trim() !== ''
        ? parsed.colorPrimario
        : DEFAULT_CONFIG.colorPrimario
    );
  } catch {
    return DEFAULT_CONFIG.colorPrimario;
  }
}

/**
 * Lectura única de nombre/logo legacy desde `taller-config`.
 * Se usa como `initialData` mientras llega la configuración del backend.
 */
function readLegacyShopIdentity(): BackendShopConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        nombreTaller: DEFAULT_CONFIG.nombreTaller,
        logo: DEFAULT_CONFIG.logo,
      };
    }
    const parsed = JSON.parse(raw) as Partial<TallerConfig>;
    return {
      nombreTaller:
        typeof parsed.nombreTaller === 'string' &&
        parsed.nombreTaller.trim() !== ''
          ? parsed.nombreTaller
          : DEFAULT_CONFIG.nombreTaller,
      logo: typeof parsed.logo === 'string' ? parsed.logo : DEFAULT_CONFIG.logo,
    };
  } catch {
    return {
      nombreTaller: DEFAULT_CONFIG.nombreTaller,
      logo: DEFAULT_CONFIG.logo,
    };
  }
}

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [colorPrimario, setColorPrimario] = useState<string>(() =>
    loadColorFromStorage(),
  );

  // Identidad del taller desde backend; fallback legacy solo una vez.
  const legacyIdentity = useMemo(() => readLegacyShopIdentity(), []);
  const { data: backendConfig } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet<BackendShopConfig>('/api/configuracion/public'),
    initialData: legacyIdentity,
    staleTime: 5 * 60 * 1000,
  });

  const config = useMemo<TallerConfig>(
    () => ({
      nombreTaller:
        backendConfig?.nombreTaller ?? DEFAULT_CONFIG.nombreTaller,
      logo: backendConfig?.logo ?? DEFAULT_CONFIG.logo,
      colorPrimario,
    }),
    [backendConfig, colorPrimario],
  );

  // Aplica el color primario en runtime cada vez que cambia
  useEffect(() => {
    applyConfigTheme(config.colorPrimario);
  }, [config.colorPrimario]);

  // Mantiene el título del documento sincronizado con el nombre del taller
  useEffect(() => {
    document.title = config.nombreTaller || DEFAULT_CONFIG.nombreTaller;
  }, [config.nombreTaller]);

  const updateConfig = useCallback((parcial: Partial<TallerConfig>) => {
    setColorPrimario((prev) => {
      const nextColor = parcial.colorPrimario ?? prev;
      if (nextColor !== prev) {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ colorPrimario: nextColor }),
          );
        } catch (err) {
          console.warn('No se pudo persistir el color del taller', err);
        }
      }
      return nextColor;
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
