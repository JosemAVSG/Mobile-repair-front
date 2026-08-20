import { Icon } from '../atoms/Icon';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useConfig } from '../../context/ConfigContext';
import { ROL_LABELS, ROL_BADGE } from '../../utils/formatters';

interface HeaderProps {
  onMenuToggle: () => void;
}

/** Iniciales a partir del nombre (o del username si no hay nombre). */
function initialsOf(name: string | null | undefined): string {
  const source = (name ?? '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const { config } = useConfig();

  const displayName = user?.nombre?.trim() || user?.username || 'Usuario';

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Abrir menú"
        >
          <Icon name="menu" size={20} />
        </button>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          {config.logo && (
            <img
              src={config.logo}
              alt="Logo del taller"
              className="h-7 w-7 rounded-full object-cover"
            />
          )}
          {config.nombreTaller}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          {config.logo ? (
            <img
              src={config.logo}
              alt={displayName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {initialsOf(displayName)}
            </div>
          )}
          <span className="text-sm font-medium text-slate-700">{displayName}</span>
          {user?.rol && (
            <Badge variant={ROL_BADGE[user.rol]}>
              {ROL_LABELS[user.rol]}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Cerrar Sesión
        </Button>
      </div>
    </header>
  );
}