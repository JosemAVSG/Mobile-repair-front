import type { ReactNode } from 'react';
import { Icon } from '../atoms/Icon';
import { useConfig } from '../../context/ConfigContext';
import { POWERED_BY } from '../../utils/brand';

interface AuthLayoutProps {
  children: ReactNode;
}

const FEATURES = [
  'Órdenes de reparación organizadas',
  'Inventario y repuestos bajo control',
  'Clientes y técnicos en un solo lugar',
];

export function AuthLayout({ children }: AuthLayoutProps) {
  const { config } = useConfig();
  const year = new Date().getFullYear();

  const logo = config.logo ? (
    <img
      src={config.logo}
      alt="Logo del taller"
      className="h-full w-full object-cover"
    />
  ) : (
    <img
      src="/favicon.svg"
      alt=""
      className="h-full w-full object-contain"
    />
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Panel de marca (solo escritorio) */}
      <aside className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-[#1f2630] via-[#161b22] to-[#0d1117] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Patrón decorativo tipo grilla */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:2.5rem_2.5rem]"
        />
        {/* Ícono decorativo translúcido */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 text-[#f7a830] opacity-10"
        >
          <Icon name="wrench" size={420} />
        </div>

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-[#f7a830]/40">
              {logo}
            </div>
            <span className="text-lg font-semibold tracking-tight">
              {config.nombreTaller}
            </span>
          </div>

          <div>
            <h2 className="text-3xl font-bold leading-tight">
              Gestión de reparaciones,
              <br /> órdenes y clientes
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
              Administra el día a día de tu taller desde un solo lugar: da
              seguimiento a cada equipo, controla tu inventario y mantén
              informados a tus clientes.
            </p>
            <ul className="mt-8 space-y-3">
              {FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-sm text-white/90"
                >
                  <Icon
                    name="check-circle"
                    size={18}
                    className="shrink-0 text-[#f7a830]"
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-white/60">
            © {year} {config.nombreTaller} · {POWERED_BY}
          </p>
        </div>
      </aside>

      {/* Panel del formulario */}
      <main className="flex w-full flex-1 items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Cabecera compacta en móvil */}
          <div className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary">
              {logo}
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {config.nombreTaller}
            </p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
