import type { ApiResponse } from '../types';

// ──────────────────────────────────────────────
// ApiError — structured error for API failures
// ──────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
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

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      body?.meta?.message ?? `Error ${res.status}: ${res.statusText}`,
      res.status,
      body,
    );
  }

  const json = await res.json();

  // Detect ApiResponse envelope
  if (json && typeof json === 'object' && 'meta' in json) {
    const apiRes = json as ApiResponse<T>;
    if (!apiRes.meta.success) {
      throw new ApiError(apiRes.meta.message || 'La solicitud falló', res.status, json);
    }
    return apiRes.data as T;
  }

  // Raw response (no envelope)
  return json as T;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function buildUrl(path: string): string {
  // path should already start with /api/
  // VITE_API_URL overrides the base for production (deployed backend).
  // In local dev, leave it unset so Vite's proxy (/api -> localhost:8080) handles it.
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}${path}`;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'GET',
    headers: buildHeaders(),
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

/**
 * POST multipart/form-data — para subida de archivos. No se setea
 * Content-Type para que el navegador agregue el boundary automáticamente.
 */
export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers,
    body: formData,
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  return handleResponse<T>(res);
}

/**
 * Raw GET — returns the full response body without ApiResponse envelope parsing.
 * Useful for endpoints that don't wrap in meta.success / meta.message.
 */
export async function apiGetRaw<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      body?.meta?.message ?? `Error ${res.status}: ${res.statusText}`,
      res.status,
      body,
    );
  }
  return res.json() as Promise<T>;
}
