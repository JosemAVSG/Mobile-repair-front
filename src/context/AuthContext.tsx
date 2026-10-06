import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/ApiClient';
import { getMe, login as loginRequest, registerTaller } from '../api/auth';
import type { AuthUser, LoginResponse, RegisterTallerRequest } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  /** Loguea contra POST /api/auth/login. Resuelve con el usuario autenticado
   *  o lanza un ApiError (mensaje del backend, p.ej. "Credenciales inválidas"). */
  login: (username: string, password: string) => Promise<AuthUser>;
  /** Alta de un taller nuevo (POST /api/auth/register-taller). Deja la sesión
   *  iniciada con el admin recién creado. */
  register: (req: RegisterTallerRequest) => Promise<AuthUser>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** true mientras se valida el token guardado contra GET /api/auth/me */
  validating: boolean;
  /** Bloqueo de facturación: estado SUSPENDIDO/CANCELADO del usuario (fuente primaria)
   *  o un 403 de billing observado (fallback: token/estado guardado stale). */
  billingBlocked: boolean;
  /** Detalle del 403 de billing (codigo + mensaje del backend), si se observó uno. */
  billingBlock: BillingBlock | null;
}

export interface BillingBlock {
  codigo: 'SUSPENDIDO' | 'CANCELADO';
  message?: string;
}

export const BILLING_BLOCK_EVENT = 'fixtra:billing-block';

function isBillingCodigo(codigo: unknown): codigo is BillingBlock['codigo'] {
  return codigo === 'SUSPENDIDO' || codigo === 'CANCELADO';
}

export const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'auth';

/** Formato persistido en localStorage: { token, user }. */
interface StoredAuth {
  token: string;
  user: AuthUser;
}

/** Normaliza el usuario: garantiza tecnicoId a partir del id del registro. */
function normalizeUser(u: AuthUser): AuthUser {
  return { ...u, tecnicoId: u.tecnicoId ?? u.id };
}

/** Primer valor realmente booleano; null/undefined/otros tipos se saltean.
 *  Sin ningún booleano el flag es `true`: un valor desconocido nunca bloquea el inventario. */
function resolveInventarioHabilitado(...candidates: unknown[]): boolean {
  for (const c of candidates) {
    if (typeof c === 'boolean') return c;
  }
  return true;
}

function parseStoredAuth(raw: string | null): StoredAuth | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (
      parsed &&
      typeof parsed.token === 'string' &&
      parsed.user &&
      typeof parsed.user === 'object' &&
      typeof parsed.user.username === 'string'
    ) {
      return { token: parsed.token, user: normalizeUser(parsed.user) };
    }
    return null;
  } catch {
    return null;
  }
}

function loadFromStorage(): StoredAuth | null {
  try {
    return parseStoredAuth(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveToStorage(auth: StoredAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  // Estado inicial desde localStorage (evita parpadeo de pantalla de login)
  const [initialStored] = useState<StoredAuth | null>(() => loadFromStorage());
  const [user, setUser] = useState<AuthUser | null>(() => initialStored?.user ?? null);
  const [token, setToken] = useState<string | null>(() => initialStored?.token ?? null);
  const [validating, setValidating] = useState<boolean>(() => initialStored != null);
  const [billingBlock, setBillingBlock] = useState<BillingBlock | null>(null);
  const sessionRevision = useRef(0);

  // El provider vive en la raíz: es el único lugar que no pierde el evento que
  // ApiClient emite durante el /me del mount, antes de que monte ningún banner.
  useEffect(() => {
    const handleBlock = (event: Event) => {
      const detail = (event as CustomEvent<{ codigo?: unknown; message?: string }>).detail;
      if (!detail || !isBillingCodigo(detail.codigo)) return;
      setBillingBlock({ codigo: detail.codigo, message: detail.message });
    };
    window.addEventListener(BILLING_BLOCK_EVENT, handleBlock);
    return () => window.removeEventListener(BILLING_BLOCK_EVENT, handleBlock);
  }, []);

  // After a successful payment-method/recovery charge, refresh /me so the billing
  // block clears as soon as the backend transitions the tenant back to ACTIVO.
  useEffect(() => {
    const handleRefresh = () => {
      if (!token) return;
      const revisionAtStart = sessionRevision.current;
      getMe()
        .then((me) => {
          if (sessionRevision.current !== revisionAtStart) return;
          const latest = loadFromStorage();
          if (!latest || latest.token !== token) return;
          const next: StoredAuth = {
            token,
            user: normalizeUser({
              ...me,
              tallerId: me.tallerId ?? latest.user.tallerId,
              inventarioHabilitado: resolveInventarioHabilitado(
                me.inventarioHabilitado,
                latest.user.inventarioHabilitado,
              ),
            }),
          };
          saveToStorage(next);
          setUser(next.user);
          setBillingBlock(null);
        })
        .catch(() => {
          // Leave existing state untouched; polling will eventually reconcile.
        });
    };
    window.addEventListener('fixtra:refresh-me', handleRefresh);
    return () => window.removeEventListener('fixtra:refresh-me', handleRefresh);
  }, [token]);

  // Storage events only fire for changes made by another document. Adopt a
  // valid session without writing it back, so this listener cannot loop.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;

      const next = parseStoredAuth(event.newValue);
      if (event.newValue !== null && !next) return;

      sessionRevision.current += 1;
      queryClient.clear();
      setBillingBlock(null);
      setValidating(false);

      if (!next) {
        setUser(null);
        setToken(null);
        return;
      }

      setUser(next.user);
      setToken(next.token);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [queryClient]);

  // En el mount: si hay token guardado, validar contra GET /api/auth/me.
  // Si falla (token expirado/inválido o backend caído) → logout; 403 billing (token stale) → keep session.
  useEffect(() => {
    const stored = initialStored;
    if (!stored) return;
    let cancelled = false;
    const revisionAtStart = sessionRevision.current;

    getMe()
      .then((me) => {
        if (cancelled || sessionRevision.current !== revisionAtStart) return;
        const latest = loadFromStorage();
        if (!latest || latest.token !== stored.token) return;
        const next: StoredAuth = {
          token: latest.token,
          user: normalizeUser({
            ...me,
            tallerId: me.tallerId ?? latest.user.tallerId,
            inventarioHabilitado: resolveInventarioHabilitado(
              me.inventarioHabilitado,
              latest.user.inventarioHabilitado,
            ),
          }),
        };
        saveToStorage(next);
        setUser(next.user);
        setToken(next.token);
      })
      .catch((err: unknown) => {
        if (cancelled || sessionRevision.current !== revisionAtStart) return;
        if (err instanceof ApiError && err.status === 403 && isBillingCodigo(err.codigo)) {
          // Token válido pero taller bloqueado: se conserva la sesión (sin clearStorage)
          // y se registra el bloqueo, porque el estado guardado puede estar desactualizado.
          setBillingBlock({ codigo: err.codigo, message: err.message });
          setUser(stored.user);
          setToken(stored.token);
        } else {
          clearStorage();
          setUser(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setValidating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialStored]);

  // Inicia sesión con la respuesta del backend (login o registro). Limpia la
  // caché de react-query ANTES de actualizar el estado: así nunca se mezclan
  // datos de un taller con los de otro.
  const startSession = useCallback(
    (response: LoginResponse): AuthUser => {
      sessionRevision.current += 1;
      queryClient.clear();
      const tallerId = response.tallerId ?? response.user.tallerId ?? null;
      // El backend replica la facturación en la raíz de la respuesta; user manda si la trae.
      const next: StoredAuth = {
        token: response.token,
        user: normalizeUser({
          ...response.user,
          tallerId,
          plan: response.user.plan ?? response.plan,
          estado: response.user.estado ?? response.estado,
          trialEndsAt: response.user.trialEndsAt ?? response.trialEndsAt,
          currentPeriodEnd: response.user.currentPeriodEnd ?? response.currentPeriodEnd,
          // Sin valor previo: una sesión anterior podría ser de otro taller.
          inventarioHabilitado: resolveInventarioHabilitado(
            response.user.inventarioHabilitado,
            response.inventarioHabilitado,
          ),
        }),
      };
      setBillingBlock(null);
      saveToStorage(next);
      setUser(next.user);
      setToken(response.token);
      return next.user;
    },
    [queryClient],
  );

  const login = useCallback(async (username: string, password: string): Promise<AuthUser> => {
    const response: LoginResponse = await loginRequest(username, password);
    return startSession(response);
  }, [startSession]);

  const register = useCallback(
    async (req: RegisterTallerRequest): Promise<AuthUser> => {
      const response: LoginResponse = await registerTaller(req);
      const started = startSession(response);
      // RegistroPage navega sin llamar /me: se refresca acá (best-effort) para tomar el estado real.
      const revisionAtStart = sessionRevision.current;
      Promise.resolve()
        .then(() => getMe())
        .then((me) => {
          if (sessionRevision.current !== revisionAtStart) return;
          const latest = loadFromStorage();
          if (!latest || latest.token !== response.token) return;
          const next: StoredAuth = {
            token: latest.token,
            user: normalizeUser({
              ...me,
              tallerId: me.tallerId ?? latest.user.tallerId,
              inventarioHabilitado: resolveInventarioHabilitado(
                me.inventarioHabilitado,
                latest.user.inventarioHabilitado,
              ),
            }),
          };
          saveToStorage(next);
          setUser(next.user);
        })
        .catch(() => {
          // Best-effort: la sesión de registro ya es válida.
        });
      return started;
    },
    [startSession],
  );

  const logout = useCallback(() => {
    // Caché fuera ANTES de cambiar el estado: ningún dato del taller anterior
    // puede quedar visible para la siguiente sesión.
    sessionRevision.current += 1;
    queryClient.clear();
    clearStorage();
    setBillingBlock(null);
    setUser(null);
    setToken(null);
  }, [queryClient]);

  const isAdmin = user?.rol === 'ADMIN';
  const billingBlocked =
    user?.estado === 'SUSPENDIDO' || user?.estado === 'CANCELADO' || billingBlock !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: user !== null,
        isAdmin,
        validating,
        billingBlocked,
        billingBlock,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
