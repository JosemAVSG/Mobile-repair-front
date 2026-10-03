import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { Icon } from '../components/atoms/Icon';
import { AuthLayout } from '../components/templates/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import {
  buildRegisterRequest,
  mapRegisterError,
  validateRegistro,
  type RegistroErrors,
  type RegistroForm,
} from '../utils/registro';

const EMPTY_FORM: RegistroForm = {
  nombreTaller: '',
  adminNombre: '',
  username: '',
  correo: '',
  telefono: '',
  password: '',
  confirmPassword: '',
};

export function RegistroPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();

  const [form, setForm] = useState<RegistroForm>(EMPTY_FORM);
  const [honeypot, setHoneypot] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegistroErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const setField = (key: keyof RegistroForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const errors = validateRegistro(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await register(buildRegisterRequest(form, honeypot));
      // El registro crea un ADMIN: va directo al dashboard.
      navigate('/', { replace: true });
    } catch (err) {
      setError(mapRegisterError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-slate-900">Crea tu taller</h1>
      <p className="mt-1 text-sm text-slate-500">
        Registra tu taller y empieza a gestionar tus reparaciones
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        <Input
          label="Nombre del taller"
          type="text"
          placeholder="Ej: Taller Rápido"
          value={form.nombreTaller}
          onChange={(e) => setField('nombreTaller')(e.target.value)}
          autoComplete="organization"
          autoFocus
          error={fieldErrors.nombreTaller}
        />
        <Input
          label="Tu nombre"
          type="text"
          value={form.adminNombre}
          onChange={(e) => setField('adminNombre')(e.target.value)}
          autoComplete="name"
          icon="user"
          error={fieldErrors.adminNombre}
        />
        <Input
          label="Correo"
          type="email"
          placeholder="correo@ejemplo.com"
          value={form.correo}
          onChange={(e) => setField('correo')(e.target.value)}
          autoComplete="email"
          error={fieldErrors.correo}
        />
        <Input
          label="Teléfono (opcional)"
          type="tel"
          value={form.telefono}
          onChange={(e) => setField('telefono')(e.target.value)}
          autoComplete="tel"
          error={fieldErrors.telefono}
        />
        <Input
          label="Usuario"
          type="text"
          placeholder="usuario"
          value={form.username}
          onChange={(e) => setField('username')(e.target.value.toLowerCase())}
          autoComplete="username"
          icon="user"
          error={fieldErrors.username}
        />
        <Input
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          placeholder="Mínimo 8 caracteres"
          value={form.password}
          onChange={(e) => setField('password')(e.target.value)}
          autoComplete="new-password"
          icon="lock"
          error={fieldErrors.password}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
              className="rounded-md p-2 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
            </button>
          }
        />
        <Input
          label="Confirmar contraseña"
          type={showPassword ? 'text' : 'password'}
          value={form.confirmPassword}
          onChange={(e) => setField('confirmPassword')(e.target.value)}
          autoComplete="new-password"
          icon="lock"
          error={fieldErrors.confirmPassword}
        />

        {/* Honeypot anti-bots: fuera de pantalla, sin foco ni autocompletado.
            Un humano nunca lo completa; si llega con valor, el backend rechaza. */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}
        >
          <label htmlFor="website">Sitio web</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            <Icon name="alert-circle" size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Crear taller
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
