import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import type { ApiResponse } from '../types';

// ──────────────────────────────────────────────
// ApiError — structured error for API failures
// ──────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  data: unknown;
  codigo?: string;

  constructor(message: string, status: number, data?: unknown, codigo?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.codigo = codigo;
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Desenvuelve el envelope ApiResponse ({ meta: { success, message }, data }).
 * Devuelve `data` cuando el envelope reporta éxito, la respuesta cruda cuando
 * no hay envelope, y lanza ApiError cuando el envelope reporta fallo.
 * (Mismo comportamiento que el client fetch anterior.)
 */
function unwrapResponse<T>(response: AxiosResponse<T>): T {
  const json = response.data as unknown;

  // Detect ApiResponse envelope
  if (json && typeof json === 'object' && 'meta' in json) {
    const apiRes = json as unknown as ApiResponse<T>;
    if (!apiRes.meta.success) {
      throw new ApiError(
        apiRes.meta.message || 'La solicitud falló',
        response.status,
        json,
      );
    }
    return apiRes.data;
  }

  // Raw response (no envelope)
  return json as T;
}

/** Convierte errores de axios en ApiError con el mensaje del backend. */
function toApiError(error: unknown): unknown {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data;
    if (status != null) {
      const meta =
        body && typeof body === 'object' && 'meta' in body
          ? (body as { meta?: { message?: string; codigo?: string } }).meta
          : undefined;
      const metaMessage = meta?.message;
      const metaCodigo = meta?.codigo;
      return new ApiError(
        metaMessage ?? `Error ${status}: ${error.response?.statusText ?? ''}`,
        status,
        body,
        metaCodigo,
      );
    }
  }
  return error;
}

// ──────────────────────────────────────────────
// Axios instance
// ──────────────────────────────────────────────

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
});

// Adjunta el JWT guardado en localStorage (key `auth` → { token }).
instance.interceptors.request.use((config) => {
  // Un FormData no puede viajar con el default `application/json`: axios lo
  // serializaría a JSON y se perdería el archivo. Se quita el Content-Type
  // para que el navegador ponga multipart/form-data con su boundary.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.setContentType(false);
  }
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Desenvuelve el envelope y normaliza los errores.
// Un 401 con sesión guardada = token vencido o inválido: se limpia y vuelve al login.
// 403 con meta.codigo SUSPENDIDO/CANCELADO no debe hacer logout (billing bloqueado).
instance.interceptors.response.use(
  (response) => unwrapResponse(response) as unknown as AxiosResponse,
  (error) => {
    const status = error?.response?.status;
    const body = error?.response?.data;
    const isLogin = error?.config?.url?.includes('/api/auth/login');

    // Handle code-aware 403 for billing: keep session
    if (status === 403 && body && typeof body === 'object' && 'meta' in body) {
      const meta = (body as { meta?: { codigo?: string; message?: string } }).meta;
      const codigo = meta?.codigo;
      if (codigo === 'SUSPENDIDO' || codigo === 'CANCELADO') {
        try {
          window.dispatchEvent(
            new CustomEvent('fixtra:billing-block', {
              detail: { codigo, message: meta?.message },
            }),
          );
        } catch {
          // ignore
        }
        return Promise.reject(toApiError(error));
      }
    }

    if (status === 401 && !isLogin && getToken()) {
      localStorage.removeItem('auth');
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(toApiError(error));
  },
);

// ──────────────────────────────────────────────
// Tipado del client
// ──────────────────────────────────────────────
// El interceptor de respuesta desenvuelve el envelope en runtime, por lo que
// los métodos resuelven directamente con el payload (`Promise<T>`) en lugar
// de `Promise<AxiosResponse<T>>`.

export interface ApiClientInstance {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T>;
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T>;
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
  interceptors: AxiosInstance['interceptors'];
  defaults: AxiosInstance['defaults'];
}

export const ApiClient = instance as unknown as ApiClientInstance;