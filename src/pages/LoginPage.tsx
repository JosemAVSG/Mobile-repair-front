import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/atoms/Card';
import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { Icon } from '../components/atoms/Icon';
import { AuthLayout } from '../components/templates/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import { useConfig } from '../context/ConfigContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const { config } = useConfig();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect
  if (isAuthenticated) {
    navigate(user?.rol === 'ADMIN' ? '/' : '/reparaciones', { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Por favor ingresa usuario y contraseña');
      return;
    }

    setLoading(true);
    try {
      const user = await login(username, password);
      // El técnico no tiene dashboard: lo mandamos directo a sus reparaciones.
      navigate(user.rol === 'ADMIN' ? '/' : '/reparaciones', { replace: true });
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Error al iniciar sesión. Intenta de nuevo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card padding={false}>
        <div className="px-8 pt-8 pb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary">
            {config.logo ? (
              <img
                src={config.logo}
                alt="Logo del taller"
                className="h-full w-full object-cover"
              />
            ) : (
              <Icon name="smartphone" size={28} className="text-white" />
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {config.nombreTaller}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Inicia sesión para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-8 pb-8">
          <Input
            label="Usuario"
            type="text"
            placeholder="usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="•••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
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
            Iniciar Sesión
          </Button>
        </form>
      </Card>
    </AuthLayout>
  );
}
