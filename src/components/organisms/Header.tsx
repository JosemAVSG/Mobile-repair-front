import { Icon } from '../atoms/Icon';
import { Button } from '../atoms/Button';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();

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
        <h1 className="text-lg font-bold text-slate-800">
          Reparaciones - Taller
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-slate-500 sm:inline">
          {user?.username ?? 'Usuario'}
        </span>
        <Button variant="ghost" size="sm" onClick={logout}>
          Cerrar Sesión
        </Button>
      </div>
    </header>
  );
}
