import { Link, useLocation, useParams } from 'react-router-dom';
import { useCliente } from '../../hooks/useQueries';

interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const params = useParams<{ id?: string }>();
  const id = params.id;

  const { data: cliente, isPending } = useCliente(id ? Number(id) : undefined);

  const crumbs = useCrumbs(pathname, id, cliente?.nombre, isPending);

  if (crumbs.length === 0) return null;

  return (
    <nav className="mb-4 flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-slate-300">/</span>}
            {isLast || !crumb.to ? (
              <span className="font-medium text-slate-700">{crumb.label}</span>
            ) : (
              <Link to={crumb.to} className="text-slate-500 hover:underline">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function useCrumbs(
  pathname: string,
  id: string | undefined,
  clienteNombre: string | undefined,
  clienteLoading: boolean,
): Crumb[] {
  if (pathname === '/') return [{ label: 'Dashboard' }];

  const segments = pathname.split('/').filter(Boolean);

  const crumbs: Crumb[] = [{ label: 'Dashboard', to: '/' }];

  if (segments[0] === 'marcas') crumbs.push({ label: 'Marcas' });
  else if (segments[0] === 'modelos') crumbs.push({ label: 'Modelos' });
  else if (segments[0] === 'clientes') {
    crumbs.push({ label: 'Clientes', to: '/clientes' });
    if (id) {
      const label = clienteLoading
        ? `Cliente #${id}`
        : clienteNombre ?? `Cliente #${id}`;
      crumbs.push({ label });
    }
  } else if (segments[0] === 'dispositivos') {
    crumbs.push({ label: 'Dispositivos' });
  } else if (segments[0] === 'reparaciones' || segments[0] === 'ordenes') {
    crumbs.push({ label: 'Reparaciones', to: '/reparaciones' });
    if (id) crumbs.push({ label: `Reparación #${id}` });
  } else if (segments[0] === 'tarifas') crumbs.push({ label: 'Tarifas' });
  else if (segments[0] === 'repuestos') crumbs.push({ label: 'Repuestos' });

  return crumbs;
}
