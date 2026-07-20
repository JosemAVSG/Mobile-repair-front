import { useLocation, Link } from 'react-router-dom';
import { Icon, type IconName } from '../atoms/Icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/marcas', label: 'Marcas', icon: 'tag' },
  { path: '/modelos', label: 'Modelos', icon: 'layers' },
  { path: '/clientes', label: 'Clientes', icon: 'users' },
  { path: '/dispositivos', label: 'Dispositivos', icon: 'smartphone' },
  { path: '/ordenes', label: 'Órdenes', icon: 'clipboard' },
  { path: '/tarifas', label: 'Tarifas', icon: 'dollar-sign' },
  { path: '/repuestos', label: 'Repuestos', icon: 'package' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center gap-2 border-b border-slate-700 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Icon name="smartphone" size={18} className="text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight">
            Reparaciones
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.path);

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => onClose()}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon
                      name={item.icon}
                      size={18}
                      className={active ? 'text-white' : 'text-slate-400'}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 px-5 py-3">
          <p className="text-xs text-slate-500">Taller de Reparaciones</p>
        </div>
      </aside>
    </>
  );
}
