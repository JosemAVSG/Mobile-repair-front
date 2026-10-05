import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/atoms/Icon';

// ──────────────────────────────────────────────
// Sistema global de notificaciones (toasts)
// ──────────────────────────────────────────────
//
// Provee `showToast` a toda la app y monta el contenedor de toasts en
// `document.body` vía portal. El contenedor usa `z-[100]` para quedar por
// encima de los modales (que usan `z-50`): como ambos se montan en
// `document.body`, el orden de apilado no basta y el z-index debe superarlos.

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

/** Tiempo de auto-cierre de cada toast. */
const AUTO_DISMISS_MS = 4000;

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

type ToastIconName = 'check-circle' | 'alert-circle' | 'info';

const VARIANT_ICONS: Record<ToastVariant, ToastIconName> = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info',
  warning: 'alert-circle',
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: number) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  // Los errores se anuncian de inmediato (role="alert" / assertive); el resto
  // de manera cortés (role="status" / polite) para no interrumpir al usuario.
  const isError = toast.variant === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${VARIANT_STYLES[toast.variant]}`}
    >
      <Icon
        name={VARIANT_ICONS[toast.variant]}
        size={18}
        className="mt-0.5 shrink-0"
      />
      <p className="flex-1 text-sm font-medium break-words">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((prev) => [...prev, { id, message, variant }]);
    },
    [],
  );

  const value = useMemo<ToastContextType>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return ctx;
}
