import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { MetricCard } from '../components/molecules/MetricCard';
import { StatusBadge, estadoConfig } from '../components/molecules/StatusBadge';
import {
  ACTIVE_STATES,
  REPAIR_STATES,
  REVENUE_STATES,
  TERMINAL_STATES,
} from '../utils/estados';
import { DataTable, type Column } from '../components/organisms/DataTable';
import { formatDate, formatCurrency } from '../utils/formatters';
import type { OrdenTrabajo, Cliente, EstadoOrden } from '../types';
import { useOrdenes, useClientes } from '../hooks/useQueries';
import { useConfig } from '../context/ConfigContext';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface OrdenRow {
  id: number;
  cliente: string;
  estado: OrdenTrabajo['estado'];
  fechaEntrada: string;
}

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

// ──────────────────────────────────────────────
// Dashboard Page
// ──────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const { config } = useConfig();

  const ordenesReq = useOrdenes();
  const clientesReq = useClientes();

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

      const activas = ordenes.filter((o) => ACTIVE_STATES.has(o.estado))
        .length;
      const enReparacion = ordenes.filter(
        (o) => REPAIR_STATES.has(o.estado),
      ).length;
      const totalClientes = clientes.length;
      const ingresos = ordenes
        .filter(
          (o) => REVENUE_STATES.has(o.estado) && o.precioTotal != null,
        )
        .reduce((sum, o) => sum + (o.precioTotal ?? 0), 0);

      // Entregados (terminal)
      const entregados = ordenes.filter((o) =>
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
      for (const o of ordenes) {
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
        metricas: { activas, enReparacion, totalClientes, ingresos, entregados },
        rows,
        proximasEntregas,
        clienteMap,
        chartData,
      };
    }, [ordenesReq.data, clientesReq.data]);

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
    { key: 'id', label: 'ID', sortable: true },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-sm text-slate-500">Panel de Control</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
          label="Entregados"
          value={metricas.entregados}
        />
        <MetricCard
          icon="users"
          label="Clientes"
          value={metricas.totalClientes}
        />
        <MetricCard
          icon="dollar-sign"
          label="Ingresos Totales"
          value={
            metricas.ingresos > 0
              ? formatCurrency(metricas.ingresos)
              : '$0'
          }
        />
      </div>

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
                    Reparación #{o.id}
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
            <Button
              variant="secondary"
              onClick={() => navigate('/repuestos')}
            >
              Ver Repuestos
            </Button>
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
        <Card title="Órdenes por Estado" subtitle="Distribución actual">
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500">No hay datos</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    formatter={(value) => [`${value} órdenes`, '']}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <Card title="Reparaciones Recientes" subtitle="Últimas 10 reparaciones">
            <DataTable<OrdenRow>
              columns={columns}
              data={rows}
              keyExtractor={(row) => row.id}
              emptyMessage="No hay reparaciones registradas"
              onRowClick={(row) => navigate(`/reparaciones/${row.id}`)}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
