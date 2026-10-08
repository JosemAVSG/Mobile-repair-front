import { useState, useMemo, useCallback } from 'react';
import { Card } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { IconActionButton } from '../components/molecules/IconActionButton';
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
import { MovimientosHistorial } from '../components/organisms/MovimientosHistorial';
import {
  useProductosInventario,
  useInventoryKpis,
  useCrearProductoInventario,
  useActualizarProductoInventario,
  useEliminarProductoInventario,
  useCrearMovimientoInventario,
  useCrearCompraInventario,
  useArchivarProductoInventario,
  useRestaurarProductoInventario,
} from '../hooks/useInventory';
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
  CompraRequest,
  MovimientosFiltro,
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

type Vista = 'productos' | 'movimientos';

interface ProductoRow {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  stock: number;
  stockMinimo: number;
  estado: EstadoStock;
  costoUnitario: number;
  precioVenta: number | null;
  archivado: boolean;
}

// ──────────────────────────────────────────────
// InventarioPage
// ──────────────────────────────────────────────

export function InventarioPage() {
  const { showToast } = useToast();

  // ───── Filter state ─────
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);
  const [vista, setVista] = useState<Vista>('productos');
  const [movFiltro, setMovFiltro] = useState<MovimientosFiltro>({});

  // ───── Data fetching ─────
  const {
    data: productos,
    isPending: productosPending,
    isFetching: productosFetching,
    error: productosError,
    refetch: refetchProductos,
  } = useProductosInventario(verArchivados);
  // Los pickers de movimientos usan siempre los activos (un archivado no admite movimientos).
  const { data: productosActivos } = useProductosInventario(false, verArchivados);
  const { data: productosArchivados } = useProductosInventario(true, vista === 'movimientos');

  const {
    data: kpis,
    isPending: kpisPending,
    error: kpisError,
  } = useInventoryKpis();

  const listaActivos = useMemo(
    () => (verArchivados ? (productosActivos ?? []) : (productos ?? [])).filter((p) => !p.archivado),
    [verArchivados, productosActivos, productos],
  );
  const listaHistorial = useMemo(() => {
    const byId = new Map<number, ProductoInventario>();
    for (const p of [...listaActivos, ...(productosArchivados ?? []), ...(verArchivados ? (productos ?? []) : [])]) {
      byId.set(p.id, p);
    }
    return [...byId.values()];
  }, [listaActivos, productosArchivados, productos, verArchivados]);

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
  const crearCompra = useCrearCompraInventario();
  const archivarProducto = useArchivarProductoInventario();
  const restaurarProducto = useRestaurarProductoInventario();

  // ───── Modal state ─────
  const [productoModalOpen, setProductoModalOpen] = useState(false);
  const [productoEditando, setProductoEditando] = useState<ProductoInventario | null>(null);

  const [movimientoModalOpen, setMovimientoModalOpen] = useState(false);
  const [productoMovimiento, setProductoMovimiento] = useState<ProductoInventario | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProductoInventario | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Tras un 409 al eliminar (el producto tiene historial) se ofrece archivarlo.
  const [archiveOffer, setArchiveOffer] = useState<{
    producto: ProductoInventario;
    message: string;
  } | null>(null);

  // ───── Filtering ─────
  const productosFiltrados = useMemo(() => {
    let data = productos ?? [];
    if (estadoFiltro) {
      data = data.filter((p) => p.estadoStock === estadoFiltro);
    }
    return data;
  }, [productos, estadoFiltro]);

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

  const openMovimientoModal = useCallback((producto: ProductoInventario | null) => {
    setProductoMovimiento(producto);
    setMovimientoModalOpen(true);
  }, []);

  const openHistorial = useCallback((producto: ProductoInventario) => {
    setMovFiltro({ productoId: producto.id });
    setVista('movimientos');
  }, []);

  const closeMovimientoModal = useCallback(() => {
    setMovimientoModalOpen(false);
    setProductoMovimiento(null);
  }, []);

  const handleSubmitAjuste = useCallback(
    async (body: MovimientoRequest) => {
      await crearMovimiento.mutateAsync(body);
    },
    [crearMovimiento],
  );

  const handleSubmitCompra = useCallback(
    async (body: CompraRequest) => {
      await crearCompra.mutateAsync(body);
    },
    [crearCompra],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await eliminarProducto.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.data as { meta?: { message?: string } } | null;
        setArchiveOffer({
          producto: deleteTarget,
          message: body?.meta?.message ?? err.message,
        });
        setDeleteTarget(null);
      } else {
        const msg = err instanceof Error ? err.message : 'Error al eliminar el producto';
        showToast(msg, 'error');
      }
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, eliminarProducto, showToast]);

  const handleArchivar = useCallback(
    async (producto: ProductoInventario) => {
      try {
        await archivarProducto.mutateAsync(producto.id);
        showToast(`"${producto.nombre}" archivado`, 'success');
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Error al archivar el producto', 'error');
      } finally {
        setArchiveOffer(null);
      }
    },
    [archivarProducto, showToast],
  );

  const handleRestaurar = useCallback(
    async (producto: ProductoInventario) => {
      try {
        await restaurarProducto.mutateAsync(producto.id);
        showToast(`"${producto.nombre}" restaurado`, 'success');
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Error al restaurar el producto', 'error');
      }
    },
    [restaurarProducto, showToast],
  );

  const renderAcciones = (producto: ProductoInventario, size?: 'lg') => {
    const stop =
      (fn: () => void) =>
      (e: React.MouseEvent) => {
        e.stopPropagation();
        fn();
      };
    return (
      <>
        <IconActionButton icon="edit" label="Editar" size={size} onClick={stop(() => openEditProducto(producto))} />
        {!producto.archivado && (
          <IconActionButton icon="repeat" label="Movimiento" size={size} onClick={stop(() => openMovimientoModal(producto))} />
        )}
        <IconActionButton icon="clipboard" label="Historial" size={size} onClick={stop(() => openHistorial(producto))} />
        {producto.archivado ? (
          <IconActionButton icon="rotate-ccw" label="Restaurar" size={size} onClick={stop(() => void handleRestaurar(producto))} />
        ) : (
          <IconActionButton icon="archive" label="Archivar" size={size} onClick={stop(() => void handleArchivar(producto))} />
        )}
        {!producto.archivado && (
          <IconActionButton icon="trash" label="Eliminar" variant="danger" size={size} onClick={stop(() => setDeleteTarget(producto))} />
        )}
      </>
    );
  };

  // ───── Columns ─────
  const columns: Column<ProductoRow>[] = [
    { key: 'codigo', label: 'Código', sortable: true },
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      render: (row) => (
        <span className={row.archivado ? 'text-slate-400' : ''}>
          {row.nombre}
          {row.archivado && <Badge variant="default">Archivado</Badge>}
        </span>
      ),
    },
    {
      key: 'stock',
      label: 'Stock',
      sortable: true,
      render: (row) => (
        <span className={row.stock === 0 ? 'font-semibold text-red-600' : ''}>{row.stock}</span>
      ),
    },
    { key: 'stockMinimo', label: 'Mínimo', sortable: true },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (row) => (
        <Badge variant={ESTADO_STOCK_VARIANTS[row.estado]}>{ESTADO_STOCK_LABELS[row.estado]}</Badge>
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
      label: 'Precio sugerido',
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
          <div className="flex flex-wrap items-center gap-2">{renderAcciones(producto)}          </div>
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
      stock: p.stock,
      stockMinimo: p.stockMinimo,
      estado: p.estadoStock,
      costoUnitario: p.costoUnitario,
      precioVenta: p.precioVenta ?? null,
      archivado: p.archivado === true,
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
            Repuestos e insumos, stock y movimientos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openMovimientoModal(null)}>
            Registrar movimiento
          </Button>
          <Button onClick={openCreateProducto}>Nuevo Producto</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon="package"
          label="Total de productos"
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

      {/* Alert banner */}
      <InventoryAlertBanner productos={listaActivos} />

      {/* Tabs */}
      <div role="tablist" aria-label="Vista de inventario" className="flex gap-2 border-b border-slate-200">
        {(
          [
            ['productos', 'Productos'],
            ['movimientos', 'Movimientos'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={vista === key}
            onClick={() => setVista(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              vista === key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === 'movimientos' && (
        <MovimientosHistorial
          productos={listaHistorial}
          filtro={movFiltro}
          onFiltroChange={setMovFiltro}
        />
      )}

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
      {vista === 'productos' && !errorMessage && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <SearchField
              placeholder="Buscar por código o nombre..."
              value={busqueda}
              onChange={setBusqueda}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={verArchivados}
              onChange={(e) => setVerArchivados(e.target.checked)}
            />
            Ver archivados
          </label>
          <div className="w-full sm:w-auto">
            <Select
              options={ESTADO_FILTER_OPTIONS}
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full sm:w-56"
            />
          </div>
        </div>
      )}

      {/* Lista: cards en mobile, toggle Lista/Grilla en desktop */}
      {vista === 'productos' && !errorMessage && (
        <EntityList<ProductoRow>
          columns={columns}
          data={rows}
          loading={productosLoading}
          emptyMessage={verArchivados ? 'No hay productos archivados' : 'No hay productos registrados'}
          getRowClassName={(row) => (row.archivado ? 'opacity-60 bg-slate-50' : '')}
          searchFilter={busqueda}
          keyExtractor={(row) => row.id}
          storageKey="vista-inventario"
          renderCard={(row) => {
            const producto = (productos ?? []).find((p) => p.id === row.id);
            return (
              <div className={row.archivado ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={`truncate text-base font-semibold ${
                        row.archivado ? 'text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {row.nombre}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {row.codigo}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {row.archivado && <Badge variant="default">Archivado</Badge>}
                    <Badge variant={ESTADO_STOCK_VARIANTS[row.estado]}>
                      {ESTADO_STOCK_LABELS[row.estado]}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  <span
                    className={
                      row.stock === 0 ? 'font-semibold text-red-600' : 'font-medium text-slate-700'
                    }
                  >
                    Stock: {row.stock}{' '}
                    <span className="font-normal text-slate-400">(mín. {row.stockMinimo})</span>
                  </span>
                  <span className="shrink-0 text-right text-slate-600">
                    <span className="block text-xs text-slate-400">
                      Costo: {formatCurrency(row.costoUnitario)}
                    </span>
                    <span className="block font-medium text-slate-700">
                      Sugerido: {row.precioVenta == null ? '—' : formatCurrency(row.precioVenta)}
                    </span>
                  </span>
                </div>
                {producto && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-2.5">
                    {renderAcciones(producto, 'lg')}
                  </div>
                )}
              </div>
            );
          }}
        />
      )}

      {/* ───── Product Modal ───── */}
      <ProductoInventarioModal
        isOpen={productoModalOpen}
        onClose={closeProductoModal}
        producto={productoEditando}
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
        productos={listaActivos}
        onSubmitCompra={handleSubmitCompra}
        onSubmitAjuste={handleSubmitAjuste}
        loading={crearMovimiento.isPending || crearCompra.isPending}
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

      {/* ───── Archive offer (409 al eliminar) ───── */}
      <ConfirmDialog
        isOpen={archiveOffer !== null}
        title="No se puede eliminar"
        message={`${archiveOffer?.message ?? ''} ¿Querés archivarlo?`}
        confirmLabel="Archivar"
        cancelLabel="Cancelar"
        variant="warning"
        loading={archivarProducto.isPending}
        onConfirm={() => archiveOffer && void handleArchivar(archiveOffer.producto)}
        onCancel={() => setArchiveOffer(null)}
      />
    </div>
  );
}
