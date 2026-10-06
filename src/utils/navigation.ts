import type { IconName } from '../components/atoms/Icon';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

export interface NavGroup {
  label: string;
  icon: IconName;
  items: NavItem[];
}

export const adminNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/reparaciones', label: 'Reparaciones', icon: 'clipboard' },
  { path: '/inventario', label: 'Inventario', icon: 'package' },
];

export const tecnicNavItems: NavItem[] = [
  { path: '/reparaciones', label: 'Reparaciones', icon: 'clipboard' },
];

export const navGroups: NavGroup[] = [
  {
    label: 'Catálogo',
    icon: 'layers',
    items: [
      { path: '/marcas', label: 'Marcas', icon: 'tag' },
      { path: '/modelos', label: 'Modelos', icon: 'layers' },
      { path: '/clientes', label: 'Clientes', icon: 'users' },
    ],
  },
];

// Acciones del área inferior (solo admin): Configuración + Técnicos
export const bottomItems: NavItem[] = [
  { path: '/tecnicos', label: 'Técnicos', icon: 'users' },
  { path: '/configuracion', label: 'Configuración', icon: 'settings' },
];

/** Entradas de navegación que el sidebar renderizaría para el rol dado. */
export function getNavEntries(isAdmin: boolean) {
  return {
    navItems: isAdmin ? adminNavItems : tecnicNavItems,
    groups: isAdmin ? navGroups : [],
    bottom: isAdmin ? bottomItems : [],
  };
}

export function countNavEntries(isAdmin: boolean): number {
  const { navItems, groups, bottom } = getNavEntries(isAdmin);
  return (
    navItems.length +
    groups.reduce((n, g) => n + g.items.length, 0) +
    bottom.length
  );
}

/** El sidebar solo aporta algo cuando hay más de una entrada de navegación. */
export function shouldShowSidebar(isAdmin: boolean): boolean {
  return countNavEntries(isAdmin) > 1;
}
