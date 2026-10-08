import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

const state = vi.hoisted(() => ({
  isAdmin: true,
  resumen: undefined as unknown,
  resumenError: null as unknown,
  ordenes: null as null | unknown[],
  refetch: vi.fn(),
  productos: [] as unknown[],
  movimientos: [] as unknown[],
  useResumen: vi.fn(),
  useProductos: vi.fn(),
  useMovimientos: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isAdmin: state.isAdmin }) }));
vi.mock('../context/ConfigContext', () => ({
  useConfig: () => ({ config: { moneda: 'COP', tiposReparacion: [] } }),
}));
vi.mock('../hooks/useDashboard', () => ({
  useDashboardResumen: (...args: unknown[]) => {
    state.useResumen(...args);
    return { data: state.resumen, error: state.resumenError, refetch: state.refetch };
  },
}));
vi.mock('../hooks/useInventory', () => ({
  useProductosInventario: (...args: unknown[]) => {
    state.useProductos(...args);
    return { data: state.productos };
  },
  useMovimientosInventario: (...args: unknown[]) => {
    state.useMovimientos(...args);
    return { data: state.movimientos };
  },
}));
vi.mock('../hooks/useQueries', () => ({
  useOrdenes: () => ({
    data: state.ordenes ?? [
      {
        id: 1,
        clienteId: 1,
        estado: 'REGISTRO',
        fechaEntrada: '2026-01-01T00:00:00',
        costoTotal: 0,
        costoFinal: 0,
        numeroOrden: 'A-1',
      },
      {
        id: 2,
        clienteId: 1,
        estado: 'ENTREGADO',
        fechaEntrada: '2026-01-02T00:00:00',
        costoTotal: 0,
        costoFinal: 0,
        numeroOrden: 'A-2',
      },
    ],
    isPending: false, error: null, refetch: vi.fn() }),
  useClientes: () => ({ data: [], isPending: false, error: null, refetch: vi.fn() }),
}));

const renderPage = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

const RESUMEN_PRO = {
  ingresos: 1234,
  ordenes: 3,
  metricasAvanzadas: true,
  costoRepuestos: 400,
  ganancia: 834,
  repuestosMasUsados: [
    { productoId: 1, nombre: 'Pantalla X', unidades: 7 },
    { productoId: 2, nombre: 'Batería Y', unidades: 3 },
  ],
};

describe('DashboardPage shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isAdmin = true;
    state.resumen = RESUMEN_PRO;
    state.resumenError = null;
    state.ordenes = null;
    state.productos = [];
    state.movimientos = [];
  });

  it('shows Ver Inventario only for ADMIN', () => {
    const { unmount } = renderPage();
    expect(screen.getByRole('button', { name: 'Ver Inventario' })).toBeInTheDocument();
    unmount();

    state.isAdmin = false;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Ver Inventario' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Nueva Reparación' })).toBeInTheDocument();
  });
});

describe('DashboardPage bloques ADMIN (Fase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isAdmin = true;
    state.resumen = RESUMEN_PRO;
    state.resumenError = null;
    state.ordenes = null;
    state.productos = [];
    state.movimientos = [];
  });

  it('TECNICO no ve ingresos ni bloques de dinero/inventario y no dispara consultas admin', () => {
    state.isAdmin = false;
    state.resumen = undefined;
    renderPage();
    expect(screen.queryByText(/Ingresos/)).toBeNull();
    expect(screen.queryByText('Costo de repuestos')).toBeNull();
    expect(screen.queryByText('Ganancia')).toBeNull();
    expect(screen.queryByText('Repuestos más usados')).toBeNull();
    expect(screen.queryByText('Repuestos por reponer')).toBeNull();
    expect(screen.queryByText('Movimientos recientes')).toBeNull();
    // Todas las consultas admin reciben enabled=false.
    expect(state.useResumen.mock.calls.every((c) => c[2] === false)).toBe(true);
    expect(state.useProductos.mock.calls.every((c) => c[1] === false)).toBe(true);
    expect(state.useMovimientos.mock.calls.every((c) => c[1] === false)).toBe(true);
  });

  it('ADMIN con métricas ve ingresos, costo, ganancia y top de repuestos', () => {
    renderPage();
    expect(screen.getByText('Ingresos (por fecha de entrega)')).toBeInTheDocument();
    expect(screen.getByText('Ingresos (por fecha de entrega)').parentElement?.textContent).toMatch(/1[.,]?234/);
    expect(screen.getByText('Costo de repuestos').parentElement?.textContent).toMatch(/400/);
    expect(screen.getByText('Ganancia').parentElement?.textContent).toMatch(/834/);
    const top = screen.getByRole('list', { name: 'Repuestos más usados' });
    expect(within(top).getByText('Pantalla X')).toBeInTheDocument();
    expect(within(top).getByText('7 u.')).toBeInTheDocument();
    expect(screen.queryByText(/Métricas avanzadas incluidas/)).toBeNull();
  });

  it('el top se limita a 5 repuestos', () => {
    state.resumen = {
      ...RESUMEN_PRO,
      repuestosMasUsados: Array.from({ length: 8 }, (_, i) => ({ productoId: i, nombre: `R${i}`, unidades: 8 - i })),
    };
    renderPage();
    expect(within(screen.getByRole('list', { name: 'Repuestos más usados' })).getAllByRole('listitem')).toHaveLength(5);
  });

  it('ADMIN sin métricas avanzadas ve solo la sugerencia de plan, sin Business', () => {
    state.resumen = {
      ingresos: 50,
      ordenes: 1,
      metricasAvanzadas: false,
      costoRepuestos: null,
      ganancia: null,
      repuestosMasUsados: null,
    };
    renderPage();
    expect(screen.getByText('Métricas avanzadas incluidas en el plan Pro')).toBeInTheDocument();
    expect(screen.queryByText('Costo de repuestos')).toBeNull();
    expect(screen.queryByText('Ganancia')).toBeNull();
    expect(screen.queryByText('Repuestos más usados')).toBeNull();
    expect(document.body.textContent).not.toMatch(/business/i);
    // Los ingresos siguen visibles.
    expect(screen.getByText('Ingresos (por fecha de entrega)')).toBeInTheDocument();
  });

  it('manda desde/hasta locales al cambiar de período y nada para "Todo"', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 10, 0, 0)); // 15-oct-2026 local
    try {
      renderPage();
      expect(state.useResumen).toHaveBeenLastCalledWith(undefined, undefined, true);

      fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
      expect(state.useResumen).toHaveBeenLastCalledWith('2026-10-15', '2026-10-15', true);

      fireEvent.click(screen.getByRole('button', { name: '7 días' }));
      expect(state.useResumen).toHaveBeenLastCalledWith('2026-10-09', '2026-10-15', true);

      fireEvent.click(screen.getByRole('button', { name: 'Este mes' }));
      expect(state.useResumen).toHaveBeenLastCalledWith('2026-10-01', '2026-10-15', true);

      fireEvent.click(screen.getByRole('button', { name: 'Este año' }));
      expect(state.useResumen).toHaveBeenLastCalledWith('2026-01-01', '2026-10-15', true);

      fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
      expect(state.useResumen).toHaveBeenLastCalledWith(undefined, undefined, true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('estados vacíos: "Todo en orden" y sin movimientos', () => {
    renderPage();
    expect(screen.getByText('Todo en orden')).toBeInTheDocument();
    expect(screen.getByText('Sin movimientos')).toBeInTheDocument();
  });

  it('por reponer: solo BAJO/SIN_STOCK no archivados, máximo 5, con enlace a Inventario', () => {
    const p = (id: number, estadoStock: string, extra: Record<string, unknown> = {}) => ({
      id, nombre: `P${id}`, stock: 0, stockMinimo: 2, estadoStock, archivado: false, ...extra,
    });
    state.productos = [
      p(1, 'OK'),
      p(2, 'BAJO', { stock: 1 }),
      p(3, 'SIN_STOCK', { archivado: true }),
      p(4, 'SIN_STOCK'),
      p(5, 'SIN_STOCK'),
      p(6, 'SIN_STOCK'),
      p(7, 'SIN_STOCK'),
      p(8, 'SIN_STOCK'),
    ];
    renderPage();
    const lista = screen.getByRole('list', { name: 'Repuestos por reponer' });
    const nombres = within(lista).getAllByRole('listitem').map((li) => li.textContent);
    expect(nombres).toHaveLength(5);
    expect(within(lista).queryByText('P1')).toBeNull();
    expect(within(lista).queryByText('P3')).toBeNull();
    expect(screen.getByRole('link', { name: 'Ir a Inventario' })).toHaveAttribute('href', '/inventario');
    expect(screen.queryByText('Todo en orden')).toBeNull();
  });

  it('movimientos recientes: pide limit 10 y muestra etiqueta, signo y producto', () => {
    state.productos = [{ id: 1, nombre: 'Pantalla X', stock: 5, stockMinimo: 1, estadoStock: 'OK' }];
    state.movimientos = [
      { id: 1, productoId: 1, tipo: 'USO_REPARACION', sentido: 'ENTRADA', cantidad: 2, createdAt: '2026-10-01T10:00:00' },
      { id: 2, productoId: 1, tipo: 'COMPRA', sentido: 'ENTRADA', cantidad: 5, createdAt: '2026-10-02T10:00:00' },
      { id: 3, productoId: 1, tipo: 'AJUSTE', sentido: 'SALIDA', cantidad: 1, createdAt: '2026-10-03T10:00:00' },
      { id: 4, productoId: 1, tipo: 'USO_REPARACION', sentido: 'SALIDA', cantidad: 3, createdAt: '2026-10-04T10:00:00' },
    ];
    renderPage();
    expect(state.useMovimientos).toHaveBeenCalledWith({ limit: 10 }, true);
    const lista = screen.getByRole('list', { name: 'Movimientos recientes' });
    expect(within(lista).getByText(/Reposición de reparación · Pantalla X/)).toBeInTheDocument();
    expect(within(lista).getByText('+2')).toBeInTheDocument();
    expect(within(lista).getByText(/Compra · Pantalla X/)).toBeInTheDocument();
    expect(within(lista).getByText('+5')).toBeInTheDocument();
    expect(within(lista).getByText('-1')).toBeInTheDocument();
    expect(within(lista).getByText(/Uso en reparación · Pantalla X/)).toBeInTheDocument();
    expect(within(lista).getByText('-3')).toBeInTheDocument();
  });

  it('movimientos recientes prefieren productoNombre (producto archivado) y caen al lookup y al #id', () => {
    state.productos = [{ id: 2, nombre: 'Lookup', stock: 5, stockMinimo: 1, estadoStock: 'OK' }];
    state.movimientos = [
      { id: 1, productoId: 9, productoNombre: 'Archivado Z', tipo: 'COMPRA', sentido: 'ENTRADA', cantidad: 1, createdAt: '2026-10-01T10:00:00' },
      { id: 2, productoId: 2, tipo: 'COMPRA', sentido: 'ENTRADA', cantidad: 1, createdAt: '2026-10-01T10:00:00' },
      { id: 3, productoId: 77, tipo: 'COMPRA', sentido: 'ENTRADA', cantidad: 1, createdAt: '2026-10-01T10:00:00' },
    ];
    renderPage();
    const lista = screen.getByRole('list', { name: 'Movimientos recientes' });
    expect(within(lista).getByText(/Archivado Z/)).toBeInTheDocument();
    expect(within(lista).getByText(/· Lookup/)).toBeInTheDocument();
    expect(within(lista).getByText(/#77/)).toBeInTheDocument();
  });

  const entregados = () => screen.getByText('Entregados').parentElement?.textContent ?? '';

  it('Entregados: ADMIN usa resumen.ordenes', () => {
    renderPage();
    expect(entregados()).toContain('3');
  });

  it('Entregados: sin resumen (no admin) conserva el conteo local', () => {
    state.isAdmin = false;
    state.resumen = undefined;
    renderPage();
    expect(entregados()).toContain('1'); // 1 orden ENTREGADO local
  });

  it('el gráfico aclara que el período es por fecha de ingreso', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    expect(screen.getByText(/por fecha de ingreso/)).toBeInTheDocument();
  });

  it('si /resumen falla muestra un error inline con Reintentar', () => {
    state.resumen = undefined;
    state.resumenError = new Error('boom');
    renderPage();
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudieron cargar los ingresos y métricas.');
    fireEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(state.refetch).toHaveBeenCalled();
  });

  it('recalcula "hasta" cuando cambia el día', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 23, 59, 0));
    try {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
      expect(state.useResumen).toHaveBeenLastCalledWith('2026-10-15', '2026-10-15', true);
      vi.setSystemTime(new Date(2026, 9, 16, 0, 1, 0));
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(state.useResumen).toHaveBeenLastCalledWith('2026-10-16', '2026-10-16', true);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('timestamps UTC (Z) del servidor', () => {
    // Todo se arma con partes locales: independiente de la zona horaria de la máquina.
    const ordenEntregada = (id: number, fechaEntrada: Date) => ({
      id,
      clienteId: 1,
      estado: 'ENTREGADO',
      fechaEntrada: fechaEntrada.toISOString(),
      numeroOrden: `Z-${id}`,
    });

    it('el filtro de período cuenta por la fechaEntrada Z según el día local', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0));
      try {
        state.isAdmin = false; // sin resumen: conteo local por fechaEntrada
        state.resumen = undefined;
        state.ordenes = [
          ordenEntregada(1, new Date(2026, 9, 7, 0, 30)), // hoy, recién pasada la medianoche
          ordenEntregada(2, new Date(2026, 9, 6, 23, 30)), // ayer, justo antes
          ordenEntregada(3, new Date(2026, 9, 7, 11, 0)), // hoy
        ];
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
        const card = screen.getByText('Entregados (Hoy)').parentElement?.textContent ?? '';
        expect(card).toContain('2');
        fireEvent.click(screen.getByRole('button', { name: '7 días' }));
        expect(screen.getByText('Entregados (7 días)').parentElement?.textContent).toContain('3');
      } finally {
        vi.useRealTimers();
      }
    });

    it('la fecha mostrada de una entrada Z es la local', () => {
      state.isAdmin = false;
      state.resumen = undefined;
      state.ordenes = [ordenEntregada(1, new Date(2026, 9, 8, 0, 15))];
      renderPage();
      expect(screen.getAllByText('08/10/2026').length).toBeGreaterThan(0);
    });

    it('fechaEntrega naive sigue siendo hora local sin desplazamiento', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0));
      try {
        state.isAdmin = false;
        state.resumen = undefined;
        state.ordenes = [
          {
            id: 9,
            clienteId: 1,
            estado: 'REPARACION',
            fechaEntrada: new Date(2026, 9, 1, 10, 0).toISOString(),
            fechaEntrega: '2026-10-09T15:30:00',
            numeroOrden: 'N-9',
          },
        ];
        renderPage();
        const entrega = screen.getByText('Reparación #N-9').closest('button') as HTMLElement;
        expect(entrega.textContent).toContain('09/10/2026');
        expect(entrega.textContent).toContain('15:30');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
