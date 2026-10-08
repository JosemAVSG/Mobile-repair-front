import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { MetricCard } from '../components/molecules/MetricCard';
import { StatusBadge, estadoConfig } from '../components/molecules/StatusBadge';
import {
  ACTIVE_STATES,
  REPAIR_STATES,
  TERMINAL_STATES,
} from '../utils/estados';
import { type Column } from '../components/organisms/DataTable';
import { EntityList } from '../components/organisms/EntityList';
import {
  cantidadConSigno,
  etiquetaMovimiento,
  formatDate,
  formatCurrency,
} from '../utils/formatters';
import { formatNumeroOrden } from '../utils/ordenes';
import type { OrdenTrabajo, Cliente, EstadoOrden } from '../types';
import { useOrdenes, useClientes } from '../hooks/useQueries';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../hooks/useAuth';
import { useDashboardResumen } from '../hooks/useDashboard';
import { useMovimientosInventario, useProductosInventario } from '../hooks/useInventory';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface OrdenRow {
  id: number;
  numeroOrden: string;
  cliente: string;
  estado: OrdenTrabajo['estado'];
  fechaEntrada: string;
}

/** Períodos disponibles para el filtro temporal del dashboard. */
type Periodo = 'hoy' | '7d' | 'mes' | 'anio' | 'todo';

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: 'mes', label: 'Este mes' },
  { value: 'anio', label: 'Este año' },
  { value: 'todo', label: 'Todo' },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function buildClienteMap(clientes: Cliente[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const c of clientes) {
    map.set(c.id, c.nombre);
  }
  return map;
}

/** Inicio del período en ms; `todo` devuelve null (sin límite). */
function inicioPeriodo(p: Periodo): number | null {
  const now = new Date();
  switch (p) {
    case 'hoy':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case '7d':
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6,
      ).getTime();
    case 'mes':
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case 'anio':
      return new Date(now.getFullYear(), 0, 1).getTime();
    case 'todo':
      return null;
  }
}

/** yyyy-MM-dd en hora local (no UTC, para que "hoy" sea el día del taller). */
function aFechaLocal(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Rango desde/hasta (inclusive) para el backend; `todo` = sin parámetros. */
function rangoPeriodo(p: Periodo): { desde?: string; hasta?: string } {
  const inicio = inicioPeriodo(p);
  if (inicio == null) return {};
  return { desde: aFechaLocal(inicio), hasta: aFechaLocal(Date.now()) };
}

// ──────────────────────────────────────────────
// Dashboard Page
// ──────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const { isAdmin } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>('todo');

  const ordenesReq = useOrdenes();
  const clientesReq = useClientes();

  // Bloques ADMIN: no bloquean el skeleton y jamás se consultan para otros roles (403).
  // `hoy` se refresca solo cuando cambia el día, para que `hasta` no quede viejo.
  const [hoy, setHoy] = useState(() => aFechaLocal(Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const actual = aFechaLocal(Date.now());
      setHoy((prev) => (prev === actual ? prev : actual));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rango = useMemo(() => rangoPeriodo(periodo), [periodo, hoy]);
  const resumenReq = useDashboardResumen(rango.desde, rango.hasta, isAdmin);
  const productosReq = useProductosInventario(false, isAdmin);
  const movimientosReq = useMovimientosInventario({ limit: 10 }, isAdmin);

  // Wait for all requests
  const loading =
    ordenesReq.isPending ||
    ordenesReq.isFetching ||
    clientesReq.isPending ||
    clientesReq.isFetching;

  const queryError = ordenesReq.error ?? clientesReq.error;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  // Derive metrics and table rows
  const { metricas, rows, proximasEntregas, clienteMap, chartData } =
    useMemo(() => {
      const ordenes = ordenesReq.data ?? [];
      const clientes = clientesReq.data ?? [];
      const clienteMap = buildClienteMap(clientes);
      const desde = inicioPeriodo(periodo);

      // Métricas temporales (ingresos, entregados, chart) se filtran por
      // fechaEntrada; activas/enReparación/clientes son estado actual global.
      const ordenesPeriodo =
        desde == null
          ? ordenes
          : ordenes.filter(
              (o) => new Date(o.fechaEntrada).getTime() >= desde,
            );

      const activas = ordenes.filter((o) => ACTIVE_STATES.has(o.estado))
        .length;
      const enReparacion = ordenes.filter(
        (o) => REPAIR_STATES.has(o.estado),
      ).length;
      const totalClientes = clientes.length;
      // Entregados (terminal) en el período
      const entregados = ordenesPeriodo.filter((o) =>
        TERMINAL_STATES.has(o.estado),
      ).length;

      // Last 10 orders, newest first
      const last10 = [...ordenes]
        .sort(
          (a, b) =>
            new Date(b.fechaEntrada).getTime() -
            new Date(a.fechaEntrada).getTime(),
        )
        .slice(0, 10);

      const rows: OrdenRow[] = last10.map((o) => ({
        id: o.id,
        numeroOrden: formatNumeroOrden(o),
        cliente: clienteMap.get(o.clienteId) ?? `Cliente #${o.clienteId}`,
        estado: o.estado,
        fechaEntrada: o.fechaEntrada,
      }));

      // Upcoming deliveries: agendadas y desde hoy, por fecha ascendente
      const ahora = new Date().getTime();
      const proximasEntregas = ordenes
        .filter(
          (o): o is OrdenTrabajo & { fechaEntrega: string } =>
            o.fechaEntrega != null,
        )
        .filter((o) => new Date(o.fechaEntrega).getTime() >= ahora)
        .sort(
          (a, b) =>
            new Date(a.fechaEntrega).getTime() -
            new Date(b.fechaEntrega).getTime(),
        )
        .slice(0, 8);

      // Chart data: orders grouped by state
      const variantToColor: Record<string, string> = {
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        default: '#94a3b8',
      };
      const stateCounts = new Map<EstadoOrden, number>();
      for (const o of ordenesPeriodo) {
        stateCounts.set(o.estado, (stateCounts.get(o.estado) ?? 0) + 1);
      }
      const chartData = Object.entries(estadoConfig)
        .map(([key, cfg]) => ({
          name: cfg.label,
          count: stateCounts.get(key as EstadoOrden) ?? 0,
          color: variantToColor[cfg.variant] ?? '#94a3b8',
        }))
        .filter((d) => d.count > 0)
        .sort((a, b) => b.count - a.count);

      return {
        metricas: { activas, enReparacion, totalClientes, entregados },
        rows,
        proximasEntregas,
        clienteMap,
        chartData,
      };
    }, [ordenesReq.data, clientesReq.data, periodo]);

  const porReponer = useMemo(
    () =>
      (productosReq.data ?? [])
        .filter((p) => !p.archivado && (p.estadoStock === 'BAJO' || p.estadoStock === 'SIN_STOCK'))
        .slice(0, 5),
    [productosReq.data],
  );
  const nombresProducto = useMemo(
    () => new Map((productosReq.data ?? []).map((p) => [p.id, p.nombre])),
    [productosReq.data],
  );
  const movimientosRecientes = (movimientosReq.data ?? []).slice(0, 10);

  // ───── Error ─────

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-500">Panel de Control</p>
        </div>

        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">
              Error al cargar datos: {error}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                void ordenesReq.refetch();
                void clientesReq.refetch();
              }}
            >
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ───── Loading ─────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-500">Panel de Control</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>

        <Card title="Reparaciones Recientes">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-full animate-pulse rounded bg-slate-100"
              />
            ))}
          </div>
        </Card>

        <Card title="Próximas Entregas">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded bg-slate-100"
              />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // ───── Empty ─────

  if (ordenesReq.data != null && ordenesReq.data.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-500">Panel de Control</p>
        </div>

        <Card>
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-lg font-medium text-slate-700">
              Bienvenido a {config.nombreTaller}
            </p>
            <p className="max-w-md text-sm text-slate-500">
              Aún no hay reparaciones registradas. Crea tu primera
              reparación para empezar a usar el sistema.
            </p>
            <Button onClick={() => navigate('/reparaciones')}>
              Crear Primera Reparación
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ───── Data ─────

  const columns: Column<OrdenRow>[] = [
    { key: 'numeroOrden', label: 'N°', sortable: true },
    { key: 'cliente', label: 'Cliente', sortable: true },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (row) => <StatusBadge estado={row.estado} />,
    },
    {
      key: 'fechaEntrada',
      label: 'Fecha Entrada',
      sortable: true,
      render: (row) => formatDate(row.fechaEntrada),
    },
  ];

  const periodoLabel =
    PERIODOS.find((p) => p.value === periodo)?.label ?? 'Todo';
  const esTodo = periodo === 'todo';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-500">Panel de Control</p>
        </div>

        {/* Filtro temporal */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                periodo === p.value
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div
        className={`grid grid-cols-2 gap-4 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
      >
        <MetricCard
          icon="clipboard"
          label="Reparaciones Activas"
          value={metricas.activas}
        />
        <MetricCard
          icon="smartphone"
          label="En Reparación"
          value={metricas.enReparacion}
        />
        <MetricCard
          icon="check-circle"
          label={esTodo ? 'Entregados' : `Entregados (${periodoLabel})`}
          value={
            isAdmin && resumenReq.data != null
              ? resumenReq.data.ordenes
              : metricas.entregados
          }
        />
        <MetricCard
          icon="users"
          label="Clientes"
          value={metricas.totalClientes}
        />
        {isAdmin && (
          /* En mobile ocupa las dos columnas; en desktop vuelve a 1/5 */
          <div className="col-span-2 lg:col-span-1">
            <MetricCard
              icon="dollar-sign"
              label={
                esTodo
                  ? 'Ingresos (por fecha de entrega)'
                  : `Ingresos por entrega (${periodoLabel})`
              }
              value={
                resumenReq.data == null
                  ? '—'
                  : formatCurrency(resumenReq.data.ingresos)
              }
            />
          </div>
        )}
      </div>

      {/* Repuestos y stock (solo ADMIN) */}
      {isAdmin && (
        <>
          {resumenReq.error && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              <span>No se pudieron cargar los ingresos y métricas.</span>
              <Button variant="secondary" size="sm" onClick={() => void resumenReq.refetch()}>
                Reintentar
              </Button>
            </div>
          )}
          {resumenReq.data?.metricasAvanzadas === false ? (
            <Card>
              <p className="text-sm text-slate-600">
                Métricas avanzadas incluidas en el plan Pro
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MetricCard
                icon="package"
                label="Costo de repuestos"
                value={
                  resumenReq.data?.costoRepuestos == null
                    ? '—'
                    : formatCurrency(resumenReq.data.costoRepuestos)
                }
              />
              <MetricCard
                icon="dollar-sign"
                label="Ganancia"
                value={
                  resumenReq.data?.ganancia == null
                    ? '—'
                    : formatCurrency(resumenReq.data.ganancia)
                }
              />
              <Card title="Repuestos más usados">
                {(resumenReq.data?.repuestosMasUsados ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">Sin repuestos usados en el período</p>
                ) : (
                  <ol className="space-y-1" aria-label="Repuestos más usados">
                    {(resumenReq.data?.repuestosMasUsados ?? []).slice(0, 5).map((r) => (
                      <li key={r.productoId} className="flex justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-slate-700">{r.nombre}</span>
                        <span className="shrink-0 font-medium text-slate-800">{r.unidades} u.</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Repuestos por reponer" subtitle="Bajo stock o sin stock">
              {porReponer.length === 0 ? (
                <p className="text-sm text-slate-500">Todo en orden</p>
              ) : (
                <ul className="space-y-1" aria-label="Repuestos por reponer">
                  {porReponer.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{p.nombre}</span>
                      <span
                        className={`shrink-0 font-medium ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}
                      >
                        {p.stock} / mín. {p.stockMinimo}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <Link to="/inventario" className="text-sm font-medium text-blue-600 hover:underline">
                  Ir a Inventario
                </Link>
              </div>
            </Card>

            <Card title="Movimientos recientes" subtitle="Últimos 10 movimientos de stock">
              {movimientosRecientes.length === 0 ? (
                <p className="text-sm text-slate-500">Sin movimientos</p>
              ) : (
                <ul className="space-y-1" aria-label="Movimientos recientes">
                  {movimientosRecientes.map((m) => {
                    const cant = cantidadConSigno(m);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-slate-700">
                          {etiquetaMovimiento(m)} ·{' '}
                          {m.productoNombre ?? nombresProducto.get(m.productoId) ?? `#${m.productoId}`}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={cant < 0 ? 'font-semibold text-red-600' : 'font-semibold text-green-700'}>
                            {cant > 0 ? `+${cant}` : cant}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">{formatDate(m.createdAt)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Próximas Entregas + Acciones Rápidas (2-column grid) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Próximas Entregas"
          subtitle="Reparaciones con cita de entrega agendada"
        >
          {proximasEntregas.length === 0 ? (
            <p className="text-sm text-slate-500">No hay entregas agendadas</p>
          ) : (
            <div className="space-y-2">
              {proximasEntregas.map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate(`/reparaciones/${o.id}`)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(o.fechaEntrega)}{' '}
                      <span className="font-normal text-slate-500">
                        {new Date(o.fechaEntrega).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {clienteMap.get(o.clienteId) ?? `Cliente #${o.clienteId}`}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-blue-600">
                    Reparación #{formatNumeroOrden(o)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Acciones Rápidas">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/reparaciones')}>
              Nueva Reparación
            </Button>
            {isAdmin && (
              <Button
                variant="secondary"
                onClick={() => navigate('/inventario')}
              >
                Ver Inventario
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => navigate('/clientes')}
            >
              Nuevo Cliente
            </Button>
          </div>
        </Card>
      </div>

      {/* Chart + Recent Orders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bar Chart */}
        <Card
          title="Órdenes por Estado"
          subtitle={
            esTodo
              ? 'Distribución actual'
              : `Distribución (${periodoLabel}, por fecha de ingreso)`
          }
        >
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500">No hay datos</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} órdenes`, '']}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <Card title="Reparaciones Recientes" subtitle="Últimas 10 reparaciones">
            <EntityList<OrdenRow>
              columns={columns}
              data={rows}
              keyExtractor={(row) => row.id}
              emptyMessage="No hay reparaciones registradas"
              onRowClick={(row) => navigate(`/reparaciones/${row.id}`)}
              viewToggle={false}
              storageKey="vista-dashboard-recientes"
              renderCard={(row) => (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-700">
                      #{row.numeroOrden}
                    </span>
                    <StatusBadge estado={row.estado} />
                  </div>
                  <p className="mt-2 truncate text-base font-semibold text-slate-900">
                    {row.cliente}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <span className="text-xs text-slate-500">
                      {formatDate(row.fechaEntrada)}
                    </span>
                  </div>
                </>
              )}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
