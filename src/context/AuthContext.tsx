import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiGet, apiPost } from '../api/client';
import type { AuthUser, LoginResponse } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  /** Loguea contra POST /api/auth/login. Resuelve con el usuario autenticado
   *  o lanza un ApiError (mensaje del backend, p.ej. "Credenciales inválidas"). */
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** true mientras se valida el token guardado contra GET /api/auth/me */
  validating: boolean;
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

function loadFromStorage(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (
      parsed &&
      typeof parsed.token === 'string' &&
      parsed.user &&
      typeof parsed.user.username === 'string'
    ) {
      return { token: parsed.token, user: normalizeUser(parsed.user) };
    }
    return null;
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
  // Estado inicial desde localStorage (evita parpadeo de pantalla de login)
  const [initialStored] = useState<StoredAuth | null>(() => loadFromStorage());
  const [user, setUser] = useState<AuthUser | null>(() => initialStored?.user ?? null);
  const [token, setToken] = useState<string | null>(() => initialStored?.token ?? null);
  const [validating, setValidating] = useState<boolean>(() => initialStored != null);

  // En el mount: si hay token guardado, validar contra GET /api/auth/me.
  // Si falla (token expirado/inválido o backend caído) → logout.
  useEffect(() => {
    const stored = initialStored;
    if (!stored) return;
    let cancelled = false;

    apiGet<AuthUser>('/api/auth/me')
      .then((me) => {
        if (cancelled) return;
        const next: StoredAuth = { token: stored.token, user: normalizeUser(me) };
        saveToStorage(next);
        setUser(next.user);
        setToken(stored.token);
      })
      .catch(() => {
        if (cancelled) return;
        clearStorage();
        setUser(null);
        setToken(null);
      })
      .finally(() => {
        if (!cancelled) setValidating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialStored]);

  const login = useCallback(async (username: string, password: string): Promise<AuthUser> => {
    const response = await apiPost<LoginResponse>('/api/auth/login', {
      username,
      password,
    });
    const next: StoredAuth = {
      token: response.token,
      user: normalizeUser(response.user),
    };
    saveToStorage(next);
    setUser(next.user);
    setToken(response.token);
    return next.user;
  }, []);

  const logout = useCallback(() => {
    clearStorage();
    setUser(null);
    setToken(null);
  }, []);

  const isAdmin = user?.rol === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: user !== null,
        isAdmin,
        validating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}