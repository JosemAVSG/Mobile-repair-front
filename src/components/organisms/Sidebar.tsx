import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Icon, type IconName } from '../atoms/Icon';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../hooks/useAuth';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

interface NavGroup {
  label: string;
  icon: IconName;
  items: NavItem[];
}

const adminNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/reparaciones', label: 'Reparaciones', icon: 'clipboard' },
  { path: '/inventario', label: 'Inventario', icon: 'package' },
];

const tecnicNavItems: NavItem[] = [
  { path: '/reparaciones', label: 'Reparaciones', icon: 'clipboard' },
];

const navGroups: NavGroup[] = [
  {
    label: 'Catálogo',
    icon: 'layers',
    items: [
      { path: '/marcas', label: 'Marcas', icon: 'tag' },
      { path: '/modelos', label: 'Modelos', icon: 'layers' },
      { path: '/clientes', label: 'Clientes', icon: 'users' },
    ],
  },
  {
    label: 'Precios',
    icon: 'dollar-sign',
    items: [
      { path: '/repuestos', label: 'Repuestos', icon: 'package' },
    ],
  },
];

// Acciones del área inferior (solo admin): Configuración + Técnicos
const bottomItems: NavItem[] = [
  { path: '/tecnicos', label: 'Técnicos', icon: 'users' },
  { path: '/configuracion', label: 'Configuración', icon: 'settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { config } = useConfig();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';

  const navItems = isAdmin ? adminNavItems : tecnicNavItems;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Un grupo arranca abierto si ya estamos dentro de uno de sus items
  const groupInitiallyOpen = (group: NavGroup) =>
    group.items.some((item) => isActive(item.path));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((g) => [g.label, groupInitiallyOpen(g)])),
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const groupActive = (group: NavGroup) =>
    group.items.some((item) => isActive(item.path));

  const linkClasses = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-primary text-white'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-slate-900 text-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center gap-2 border-b border-slate-700 px-5">
          {config.logo ? (
            <img
              src={config.logo}
              alt="Logo del taller"
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Icon name="smartphone" size={18} className="text-white" />
            </div>
          )}
          <span className="truncate text-base font-semibold tracking-tight">
            {config.nombreTaller}
          </span>
        </div>

        {/* Nav items (única zona con scroll; min-h-0 permite que se encoja
            y deje fija la sección de Configuración abajo) */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.path);

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => onClose()}
                    className={linkClasses(active)}
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

            {isAdmin &&
              navGroups.map((group) => {
                const active = groupActive(group);
                const open = openGroups[group.label] ?? false;

                return (
                  <li key={group.label}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      aria-expanded={open}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-primary text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon
                        name={group.icon}
                        size={18}
                        className={active ? 'text-white' : 'text-slate-400'}
                      />
                      <span className="flex-1 text-left">{group.label}</span>
                      <Icon
                        name={open ? 'chevron-down' : 'chevron-right'}
                        size={16}
                        className={active ? 'text-white' : 'text-slate-500'}
                      />
                    </button>

                    {open && (
                      <ul className="mt-1 space-y-1 pl-4">
                        {group.items.map((item) => {
                          const itemActive = isActive(item.path);

                          return (
                            <li key={item.path}>
                              <Link
                                to={item.path}
                                onClick={() => onClose()}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                  itemActive
                                    ? 'bg-primary/90 text-white'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                              >
                                <Icon
                                  name={item.icon}
                                  size={16}
                                  className={
                                    itemActive ? 'text-white' : 'text-slate-500'
                                  }
                                />
                                {item.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
          </ul>
        </nav>

        {/* Bottom: configuración + técnicos (solo admin) + footer. Para el
            técnico esta sección se oculta por completo. */}
        {isAdmin && (
          <div className="mt-auto shrink-0 border-t border-slate-700 px-3 py-3">
            {bottomItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onClose()}
                className={linkClasses(isActive(item.path))}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  className={isActive(item.path) ? 'text-white' : 'text-slate-400'}
                />
                {item.label}
              </Link>
            ))}
            <p className="mt-3 px-3 text-xs text-slate-500">
              Sistema de gestión de reparaciones
            </p>
          </div>
        )}
      </aside>
    </>
  );
}