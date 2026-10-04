import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/ApiClient';
import {
  buildRegisterRequest,
  mapRegisterError,
  validateRegistro,
  type RegistroForm,
} from './registro';

const valid: RegistroForm = {
  nombreTaller: 'Taller Rápido',
  adminNombre: 'Ana',
  username: 'ana.taller',
  correo: 'ana@correo.com',
  telefono: '',
  password: 'password1',
  confirmPassword: 'password1',
};

describe('validateRegistro', () => {
  it('acepta un formulario válido', () => {
    expect(validateRegistro(valid)).toEqual({});
  });

  it('valida usuario, correo, contraseña y confirmación', () => {
    const errors = validateRegistro({
      ...valid,
      username: 'A b',
      correo: 'nope',
      password: 'short',
      confirmPassword: 'other',
    });
    expect(errors.username).toBeDefined();
    expect(errors.correo).toBeDefined();
    expect(errors.password).toMatch(/8 caracteres/);
    expect(errors.confirmPassword).toMatch(/no coinciden/);
  });
});

describe('buildRegisterRequest', () => {
  it('normaliza el usuario, omite teléfono vacío y envía el honeypot', () => {
    const req = buildRegisterRequest({ ...valid, username: ' Ana.Taller ' }, '');
    expect(req.username).toBe('ana.taller');
    expect(req).not.toHaveProperty('telefono');
    expect(req.website).toBe('');
    expect(req).not.toHaveProperty('confirmPassword');
  });
});

describe('mapRegisterError', () => {
  it('409 = usuario duplicado', () => {
    expect(mapRegisterError(new ApiError('x', 409))).toMatch(/ya está en uso/);
  });
  it('429 = demasiados intentos', () => {
    expect(mapRegisterError(new ApiError('x', 429))).toMatch(/Demasiados intentos/);
  });
  it('403 = registro deshabilitado', () => {
    expect(mapRegisterError(new ApiError('Registro deshabilitado', 403))).toMatch(
      /deshabilitado/,
    );
  });
  it('400 usa el mensaje del backend', () => {
    expect(mapRegisterError(new ApiError('Usuario reservado', 400))).toBe(
      'Usuario reservado',
    );
  });
  it('errores desconocidos tienen mensaje por defecto', () => {
    expect(mapRegisterError('boom')).toMatch(/No se pudo completar/);
  });
});
