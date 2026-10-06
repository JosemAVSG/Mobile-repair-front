import { useState, useMemo, useCallback } from 'react';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Select } from '../components/atoms/Select';
import { MetricCard } from '../components/molecules/MetricCard';
import { SearchField } from '../components/molecules/SearchField';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { type Column } from '../components/organisms/DataTable';
import { EntityList } from '../components/organisms/EntityList';
import { InventoryAlertBanner } from '../components/organisms/InventoryAlertBanner';
import { ProductoInventarioModal } from '../components/organisms/ProductoInventarioModal';
import { MovimientoInventarioModal } from '../components/organisms/MovimientoInventarioModal';
import {
  useProductosInventario,
  useInventoryKpis,
  useCrearProductoInventario,
  useActualizarProductoInventario,
  useEliminarProductoInventario,
  useCrearMovimientoInventario,
} from '../hooks/useInventory';
import { useInventarioHabilitado } from '../hooks/useInventarioHabilitado';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../api/ApiClient';
import {
  ESTADO_STOCK_LABELS,
  ESTADO_STOCK_VARIANTS,
  formatCurrency,
} from '../utils/formatters';
import type {
  EstadoStock,
  ProductoInventario,
  ProductoInventarioRequest,
  MovimientoRequest,
  UsoProducto,
} from '../types';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const ESTADO_FILTER_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'OK', label: 'OK' },
  { value: 'BAJO', label: 'Bajo stock' },
  { value: 'SIN_STOCK', label: 'Sin stock' },
];

const USO_FILTER_OPTIONS: { value: '' | UsoProducto; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'VENTA', label: 'Venta' },
  { value: 'REPUESTO', label: 'Repuesto' },
  { value: 'AMBOS', label: 'Ambos' },
];

const USO_LABELS: Record<UsoProducto, string> = {
  VENTA: 'Venta',
  REPUESTO: 'Repuesto',
  AMBOS: 'Ambos',
};

interface ProductoRow {
  uso: UsoProducto;
  controlaStock: boolean;
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  stock: number;
  stockMinimo: number;
  estado: EstadoStock;
  costoUnitario: number;
  precioVenta: number | null;
}

// ──────────────────────────────────────────────
// InventarioPage
// ──────────────────────────────────────────────

export function InventarioPage() {
  const { showToast } = useToast();
  const inventarioHabilitado = useInventarioHabilitado();

  // ───── Filter state ─────
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [usoFiltro, setUsoFiltro] = useState<'' | UsoProducto>('');

  // ───── Data fetching ─────
  const {
    data: productos,
    isPending: productosPending,
    isFetching: productosFetching,
    error: productosError,
    refetch: refetchProductos,
  } = useProductosInventario();

  const {
    data: kpis,
    isPending: kpisPending,
    error: kpisError,
  } = useInventoryKpis(inventarioHabilitado);

  const productosLoading = productosPending || productosFetching;
  const errorMessage = useMemo(() => {
    const err = productosError ?? kpisError;
    if (!err) return null;
    return err instanceof Error ? err.message : String(err);
  }, [productosError, kpisError]);

  // ───── Mutations ─────
  const crearProducto = useCrearProductoInventario();
  const actualizarProducto = useActualizarProductoInventario();
  const eliminarProducto = useEliminarProductoInventario();
  const crearMovimiento = useCrearMovimientoInventario();

  // ───── Modal state ─────
  const [productoModalOpen, setProductoModalOpen] = useState(false);
  const [productoEditando, setProductoEditando] = useState<ProductoInventario | null>(null);

  const [movimientoModalOpen, setMovimientoModalOpen] = useState(false);
  const [productoMovimiento, setProductoMovimiento] = useState<ProductoInventario | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProductoInventario | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ───── Filtering ─────
  const productosFiltrados = useMemo(() => {
    let data = productos ?? [];
    if (usoFiltro) {
      data = data.filter((p) => (p.uso ?? 'VENTA') === usoFiltro);
    }
    if (estadoFiltro) {
      // Sin control de stock no hay estado: no matchean ningún filtro de estado.
      data = data.filter((p) => p.controlaStock !== false && p.estadoStock === estadoFiltro);
    }
    return data;
  }, [productos, estadoFiltro, usoFiltro]);

  // ───── Handlers ─────
  const openCreateProducto = useCallback(() => {
    setProductoEditando(null);
    setProductoModalOpen(true);
  }, []);

  const openEditProducto = useCallback((producto: ProductoInventario) => {
    setProductoEditando(producto);
    setProductoModalOpen(true);
  }, []);

  const closeProductoModal = useCallback(() => {
    setProductoModalOpen(false);
    setProductoEditando(null);
  }, []);

  const handleSubmitProducto = useCallback(
    async (body: ProductoInventarioRequest) => {
      try {
        if (productoEditando) {
          await actualizarProducto.mutateAsync({ id: productoEditando.id, body });
        } else {
          await crearProducto.mutateAsync(body);
        }
      } catch (err: unknown) {
        // 403 PLAN_REQUERIDO: el plan no permite este tipo de producto. Se avisa y se relanza
        // para que el modal siga abierto mostrando el error.
        if (err instanceof ApiError && err.status === 403 && err.codigo === 'PLAN_REQUERIDO') {
          showToast(err.message, 'error');
        }
        throw err;
      }
    },
    [productoEditando, actualizarProducto, crearProducto, showToast],
  );

  const openMovimientoModal = useCallback((producto: ProductoInventario) => {
    setProductoMovimiento(producto);
    setMovimientoModalOpen(true);
  }, []);

  const closeMovimientoModal = useCallback(() => {
    setMovimientoModalOpen(false);
    setProductoMovimiento(null);
  }, []);

  const handleSubmitMovimiento = useCallback(
    async (body: MovimientoRequest) => {
      await crearMovimiento.mutateAsync(body);
    },
    [crearMovimiento],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await eliminarProducto.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el producto';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, eliminarProducto, showToast]);

  // ───── Columns ─────
  const columns: Column<ProductoRow>[] = [
    { key: 'codigo', label: 'Código', sortable: true },
    { key: 'nombre', label: 'Nombre', sortable: true },
    {
      key: 'uso',
      label: 'Uso',
      sortable: true,
      render: (row) => <Badge variant="info">{USO_LABELS[row.uso]}</Badge>,
    },
    {
      key: 'stock',
      label: 'Stock',
      sortable: true,
      render: (row) =>
        row.controlaStock ? (
          <span className={row.stock === 0 ? 'font-semibold text-red-600' : ''}>{row.stock}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'stockMinimo',
      label: 'Mínimo',
      sortable: true,
      render: (row) => (row.controlaStock ? row.stockMinimo : '—'),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (row) =>
        row.controlaStock ? (
          <Badge variant={ESTADO_STOCK_VARIANTS[row.estado]}>
            {ESTADO_STOCK_LABELS[row.estado]}
          </Badge>
        ) : (
          '—'
        ),
    },
    {
      key: 'costoUnitario',
      label: 'Costo unitario',
      sortable: true,
      render: (row) => formatCurrency(row.costoUnitario),
    },
    {
      key: 'precioVenta',
      label: 'Precio venta',
      sortable: true,
      render: (row) =>
        row.precioVenta == null ? '—' : formatCurrency(row.precioVenta),
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (row) => {
        const producto = (productos ?? []).find((p) => p.id === row.id);
        if (!producto) return null;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                openEditProducto(producto);
              }}
            >
              Editar
            </Button>
            {inventarioHabilitado && producto.controlaStock !== false && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  openMovimientoModal(producto);
                }}
              >
                Movimiento
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setDeleteTarget(producto);
              }}
            >
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  const rows = useMemo<ProductoRow[]>(() => {
    return productosFiltrados.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion ?? null,
      uso: p.uso ?? 'VENTA',
      controlaStock: p.controlaStock !== false,
      stock: p.stock,
      stockMinimo: p.stockMinimo,
      estado: p.estadoStock,
      costoUnitario: p.costoUnitario,
      precioVenta: p.precioVenta ?? null,
    }));
  }, [productosFiltrados]);

  // ───── Render ─────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
          <p className="text-sm text-slate-500">
            Gestión de productos (venta y repuestos), stock y movimientos
          </p>
        </div>
        <Button onClick={openCreateProducto}>Nuevo Producto</Button>
      </div>

      {/* KPIs (requieren plan con inventario) */}
      {!inventarioHabilitado && (
        <Card>
          <p className="text-sm text-slate-600">
            El control de stock, las alertas y los movimientos requieren el plan con ventas e
            inventario. Con tu plan actual podés gestionar repuestos.
          </p>
        </Card>
      )}
      {inventarioHabilitado && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon="package"
          label="Productos vendibles"
          value={kpisPending ? '—' : (kpis?.totalProductos ?? 0)}
        />
        <MetricCard
          icon="alert-circle"
          label="Bajo stock"
          value={kpisPending ? '—' : (kpis?.bajoStock ?? 0)}
          variant="warning"
        />
        <MetricCard
          icon="info"
          label="Sin stock"
          value={kpisPending ? '—' : (kpis?.sinStock ?? 0)}
          variant="danger"
        />
        <MetricCard
          icon="dollar-sign"
          label="Valor total"
          value={kpisPending ? '—' : formatCurrency(kpis?.valorTotalStock ?? 0)}
        />
      </div>
      )}

      {/* Alert banner */}
      {inventarioHabilitado && <InventoryAlertBanner productos={productos ?? []} />}

      {/* Error state */}
      {errorMessage && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-red-600">Error al cargar inventario: {errorMessage}</p>
            <Button variant="secondary" onClick={() => void refetchProductos()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      {!errorMessage && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <SearchField
              placeholder="Buscar por código o nombre..."
              value={busqueda}
              onChange={setBusqueda}
            />
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrar por uso"
          >
            {USO_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value || 'todos'}
                type="button"
                aria-pressed={usoFiltro === opt.value}
                onClick={() => setUsoFiltro(opt.value)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  usoFiltro === opt.value
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {inventarioHabilitado && (
          <div className="w-full sm:w-auto">
            <Select
              options={ESTADO_FILTER_OPTIONS}
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full sm:w-56"
            />
          </div>
          )}
        </div>
      )}

      {/* Lista: cards en mobile, toggle Lista/Grilla en desktop */}
      {!errorMessage && (
        <EntityList<ProductoRow>
          columns={columns}
          data={rows}
          loading={productosLoading}
          emptyMessage="No hay productos registrados"
          searchFilter={busqueda}
          keyExtractor={(row) => row.id}
          storageKey="vista-inventario"
          renderCard={(row) => {
            const producto = (productos ?? []).find((p) => p.id === row.id);
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">
                      {row.nombre}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {row.codigo}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="info">{USO_LABELS[row.uso]}</Badge>
                    {row.controlaStock && (
                      <Badge variant={ESTADO_STOCK_VARIANTS[row.estado]}>
                        {ESTADO_STOCK_LABELS[row.estado]}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  {row.controlaStock ? (
                    <span
                      className={
                        row.stock === 0
                          ? 'font-semibold text-red-600'
                          : 'font-medium text-slate-700'
                      }
                    >
                      Stock: {row.stock}{' '}
                      <span className="font-normal text-slate-400">
                        (mín. {row.stockMinimo})
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400">Sin control de stock</span>
                  )}
                  <span className="shrink-0 text-right text-slate-600">
                    <span className="block text-xs text-slate-400">
                      Costo: {formatCurrency(row.costoUnitario)}
                    </span>
                    <span className="block font-medium text-slate-700">
                      Venta: {row.precioVenta == null ? '—' : formatCurrency(row.precioVenta)}
                    </span>
                  </span>
                </div>
                {producto && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        openEditProducto(producto);
                      }}
                    >
                      Editar
                    </Button>
                    {inventarioHabilitado && producto.controlaStock !== false && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        openMovimientoModal(producto);
                      }}
                    >
                      Movimiento
                    </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setDeleteTarget(producto);
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                )}
              </>
            );
          }}
        />
      )}

      {/* ───── Product Modal ───── */}
      <ProductoInventarioModal
        isOpen={productoModalOpen}
        onClose={closeProductoModal}
        producto={productoEditando}
        inventarioHabilitado={inventarioHabilitado}
        onSubmit={handleSubmitProducto}
        loading={
          crearProducto.isPending || actualizarProducto.isPending
        }
      />

      {/* ───── Movement Modal ───── */}
      <MovimientoInventarioModal
        isOpen={movimientoModalOpen}
        onClose={closeMovimientoModal}
        producto={productoMovimiento}
        onSubmit={handleSubmitMovimiento}
        loading={crearMovimiento.isPending}
      />

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar Producto"
        message={`¿Estás seguro de eliminar el producto "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
