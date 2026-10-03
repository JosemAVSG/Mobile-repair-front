import { ApiError } from '../api/ApiClient';
import type { RegisterTallerRequest } from '../types';

/** Mismas reglas que el backend (RegisterTallerRequest). */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegistroField =
  | 'nombreTaller'
  | 'adminNombre'
  | 'username'
  | 'correo'
  | 'password'
  | 'confirmPassword'
  | 'telefono';

export type RegistroErrors = Partial<Record<RegistroField, string>>;

export interface RegistroForm {
  nombreTaller: string;
  adminNombre: string;
  username: string;
  correo: string;
  telefono: string;
  password: string;
  confirmPassword: string;
}

/** Validación del lado cliente. El backend sigue siendo la fuente de verdad. */
export function validateRegistro(form: RegistroForm): RegistroErrors {
  const errors: RegistroErrors = {};
  const nombreTaller = form.nombreTaller.trim();
  if (nombreTaller.length < 2 || nombreTaller.length > 100) {
    errors.nombreTaller = 'El nombre del taller debe tener entre 2 y 100 caracteres';
  }
  const adminNombre = form.adminNombre.trim();
  if (!adminNombre) errors.adminNombre = 'Tu nombre es obligatorio';
  else if (adminNombre.length > 100) errors.adminNombre = 'Máximo 100 caracteres';

  if (!USERNAME_PATTERN.test(form.username.trim().toLowerCase())) {
    errors.username =
      'Usa 3 a 30 caracteres: letras minúsculas, números, punto, guion o guion bajo';
  }
  if (!EMAIL_PATTERN.test(form.correo.trim()) || form.correo.trim().length > 150) {
    errors.correo = 'Ingresa un correo válido';
  }
  if (form.telefono.trim().length > 30) errors.telefono = 'Máximo 30 caracteres';

  if (form.password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres';
  } else if (form.password.length > 72) {
    errors.password = 'La contraseña no puede superar 72 caracteres';
  }
  if (form.confirmPassword !== form.password) {
    errors.confirmPassword = 'Las contraseñas no coinciden';
  }
  return errors;
}

/** Arma el body del registro (username normalizado, honeypot vacío). */
export function buildRegisterRequest(
  form: RegistroForm,
  honeypot: string,
): RegisterTallerRequest {
  const telefono = form.telefono.trim();
  return {
    nombreTaller: form.nombreTaller.trim(),
    adminNombre: form.adminNombre.trim(),
    username: form.username.trim().toLowerCase(),
    password: form.password,
    correo: form.correo.trim(),
    ...(telefono ? { telefono } : {}),
    website: honeypot,
  };
}

/** Mensaje para el usuario según el error devuelto por el registro. */
export function mapRegisterError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 409:
        return 'Ese nombre de usuario ya está en uso. Elige otro.';
      case 429:
        return 'Demasiados intentos de registro. Espera un momento e inténtalo de nuevo.';
      case 403:
        return 'El registro de nuevos talleres está deshabilitado por el momento.';
      case 400:
        return err.message || 'Revisa los datos ingresados.';
      default:
        return err.message || 'No se pudo completar el registro. Inténtalo de nuevo.';
    }
  }
  return err instanceof Error && err.message
    ? err.message
    : 'No se pudo completar el registro. Inténtalo de nuevo.';
}
