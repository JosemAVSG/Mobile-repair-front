import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OrdenDetailPage } from './OrdenDetailPage';
import { asignarTecnico, iniciarReparacion, updateOrdenEstado, updateReparacionRepuestos } from '../api/ordenes';
import { EstadoOrden } from '../types';

const state = vi.hoisted(() => ({
  user: { id: 7, nombre: 'Tec Uno', username: 'tec', rol: 'TECNICO', activo: true, tecnicoId: 7 } as Record<string, unknown>,
  tecnicos: undefined as unknown,
  orden: null as unknown,
  showToast: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock('../api/ordenes', () => ({
  addReparacion: vi.fn(),
  asignarTecnico: vi.fn(),
  iniciarReparacion: vi.fn().mockResolvedValue({}),
  updateEntrega: vi.fn(),
  updateOrdenEstado: vi.fn(),
  updateReparacionRepuestos: vi.fn().mockResolvedValue({}),
}));
vi.mock('../components/atoms/Tooltip', () => ({
  Tooltip: ({ content, children }: { content: string; children: React.ReactNode }) => (
    <div title={content}>{children}</div>
  ),
}));
vi.mock('../api/tarifas', () => ({ resolverPrecioTarifa: vi.fn().mockResolvedValue(null) }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('../context/ConfigContext', () => ({ useConfig: () => ({ config: { nombreTaller: 'Fixtra' } }) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: state.showToast }) }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: (...a: unknown[]) => state.invalidate(...a) }),
  useMutation: (opts: { mutationFn: (v: never) => Promise<unknown>; onSuccess?: () => unknown }) => ({
    // Espeja a react-query: mutateAsync resuelve recién cuando onSuccess (que puede esperar
    // el refetch) termina.
    mutateAsync: async (v: never) => {
      const result = await opts.mutationFn(v);
      await opts.onSuccess?.();
      return result;
    },
    isPending: false,
  }),
}));

const REPUESTOS = [
  { id: 1, nombre: 'Pantalla X', precioCosto: 50, precioVenta: 80 },
  { id: 2, nombre: 'Batería Y', precioCosto: 10, precioVenta: null },
  { id: 3, nombre: 'Cable Z', precioCosto: 5, precioVenta: 9 },
];

vi.mock('../hooks/useQueries', () => ({
  useOrden: () => ({ data: state.orden, isPending: false, isFetching: false, error: null, refetch: vi.fn() }),
  useCliente: () => ({ data: undefined }),
  useModelo: () => ({ data: undefined }),
  useMarcas: () => ({ data: [] }),
  useModelos: () => ({ data: [] }),
  useHistorialOrden: () => ({ data: [] }),
  useTecnicos: () => ({ data: state.tecnicos }),
  useFotosOrden: () => ({ data: [], isPending: false, isLoading: false, error: null }),
  useSubirFotoOrden: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEliminarFotoOrden: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRepuestos: () => ({ data: REPUESTOS, isPending: false }),
}));

function makeOrden(over: Record<string, unknown> = {}) {
  return {
    id: 10,
    clienteId: 1,
    tecnicoId: 7,
    estado: EstadoOrden.DIAGNOSTICO,
    falloReportado: 'No enciende',
    precioTotal: 100,
    fechaEntrada: '2026-01-01T00:00:00',
    fechaSalida: null,
    reparaciones: [
      {
        id: 100,
        ordenId: 10,
        tipo: 'OTRO',
        descripcion: 'Revisión inicial',
        precio: 20,
        precioRepuesto: 80,
        createdAt: '',
        repuestos: [{ id: 900, repuestoId: null, productoId: 1, nombre: 'Pantalla X', precioCosto: 50, precioVenta: 80, precioCobrado: 80 }],
      },
    ],
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reparaciones/10']}>
      <Routes>
        <Route path="/reparaciones/:id" element={<OrdenDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrdenDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: 7, nombre: 'Tec Uno', username: 'tec', rol: 'TECNICO', activo: true, tecnicoId: 7 };
    state.tecnicos = undefined; // GET /api/tecnicos es ADMIN-only: el TECNICO no recibe lista
    state.orden = makeOrden();
    state.showToast = vi.fn();
    state.invalidate = vi.fn();
  });

  describe('técnico responsable', () => {
    it('un TECNICO asignado se ve como responsable y no se le ofrece asignarse', () => {
      renderPage();
      expect(screen.queryByText('Sin técnico asignado')).not.toBeInTheDocument();
      expect(screen.getByText('Tec Uno')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Asignarme' })).not.toBeInTheDocument();
    });

    it('sin tecnicoId sigue mostrando "Sin técnico asignado" y Asignarme', () => {
      state.orden = makeOrden({ tecnicoId: null });
      renderPage();
      expect(screen.getByText('Sin técnico asignado')).toBeInTheDocument();
    });
  });

  describe('modal Diagnóstico → Reparación', () => {
    const abrir = async () => {
      renderPage();
      fireEvent.click(within(screen.getByTitle('Aprobar y Reparar')).getByRole('button'));
      return screen.findByRole('dialog');
    };
    const iniciar = (dialog: HTMLElement) => {
      fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'PANTALLA' } });
      fireEvent.change(within(dialog).getByPlaceholderText('Ej: 150'), { target: { value: '100' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Iniciar Reparación' }));
    };

    it('arranca sin selección y envía repuestos con su cantidad', async () => {
      const dialog = await abrir();
      expect(within(dialog).getByRole('checkbox', { name: /Pantalla X/ })).not.toBeChecked();
      expect(within(dialog).queryByText('ya cobrado')).toBeNull();

      fireEvent.click(within(dialog).getByRole('checkbox', { name: /Cable Z/ }));
      fireEvent.change(within(dialog).getByLabelText('Cantidad de Cable Z'), { target: { value: '3' } });
      fireEvent.click(within(dialog).getByRole('checkbox', { name: /Pantalla X/ }));
      iniciar(dialog);

      await waitFor(() => expect(iniciarReparacion).toHaveBeenCalled());
      const body = vi.mocked(iniciarReparacion).mock.calls[0][1];
      expect(body.repuestos).toEqual(
        expect.arrayContaining([
          { productoId: 3, cantidad: 3 },
          { productoId: 1, cantidad: 1 },
        ]),
      );
      expect(body.repuestos).toHaveLength(2);
      expect('repuestoIds' in body).toBe(false);
    });

    it('el preview de repuestos y el total se multiplican por la cantidad', async () => {
      const dialog = await abrir();
      fireEvent.click(within(dialog).getByRole('checkbox', { name: /Cable Z/ })); // precio 9
      fireEvent.change(within(dialog).getByLabelText('Cantidad de Cable Z'), { target: { value: '4' } });
      fireEvent.change(within(dialog).getByPlaceholderText('Ej: 150'), { target: { value: '100' } });
      expect(within(dialog).getByText('Repuestos (a cobrar):').nextSibling?.textContent).toMatch(/36/);
      expect(within(dialog).getByText('Total a cobrar:').nextSibling?.textContent).toMatch(/136/);
    });

    it('la cantidad no baja de 1', async () => {
      const dialog = await abrir();
      fireEvent.click(within(dialog).getByRole('checkbox', { name: /Cable Z/ }));
      fireEvent.change(within(dialog).getByLabelText('Cantidad de Cable Z'), { target: { value: '0' } });
      expect(within(dialog).getByLabelText('Cantidad de Cable Z')).toHaveValue(1);
    });

    it('un 400 de stock insuficiente se muestra y el diálogo sigue abierto', async () => {
      const msg = 'Stock insuficiente de Cable Z. Disponible: 1';
      vi.mocked(iniciarReparacion).mockRejectedValueOnce(new Error(msg));
      const dialog = await abrir();
      fireEvent.click(within(dialog).getByRole('checkbox', { name: /Cable Z/ }));
      iniciar(dialog);
      await waitFor(() => expect(state.showToast).toHaveBeenCalledWith(msg, 'error'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('sección Repuestos', () => {
    beforeEach(() => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [
          makeOrden().reparaciones[0],
          {
            id: 101,
            ordenId: 10,
            tipo: 'PANTALLA',
            descripcion: null,
            precio: 120,
            createdAt: '',
            repuestos: [{ id: 901, repuestoId: null, productoId: 2, nombre: 'Batería Y', precioCosto: 10, precioVenta: null, precioCobrado: 10 }],
          },
        ],
      });
    });

    it('lista los repuestos adjuntos con su precio snapshot', () => {
      renderPage();
      const lista = screen.getByRole('list', { name: 'Repuestos adjuntos' });
      expect(within(lista).getByText('Pantalla X')).toBeInTheDocument();
      expect(within(lista).getByText('Batería Y')).toBeInTheDocument();
    });

    it('agrega un repuesto con cantidad reenviando el conjunto completo de la reparación', async () => {
      renderPage();
      fireEvent.change(screen.getByLabelText('Agregar repuesto'), { target: { value: '3' } });
      fireEvent.change(screen.getByLabelText('Cantidad a agregar'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
      await waitFor(() =>
        expect(updateReparacionRepuestos).toHaveBeenCalledWith(10, 101, [
          { productoId: 2, cantidad: 1 },
          { productoId: 3, cantidad: 2 },
        ]),
      );
    });

    it('agregar un producto ya presente suma unidades', async () => {
      renderPage();
      fireEvent.change(screen.getByLabelText('Agregar repuesto'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
      await waitFor(() =>
        expect(updateReparacionRepuestos).toHaveBeenCalledWith(10, 101, [{ productoId: 2, cantidad: 2 }]),
      );
    });

    it('quita un repuesto enviando el resto', async () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Quitar Batería Y' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/¿Quitar Batería Y .*de la orden\? El total se recalculará\./)).toBeInTheDocument();
      expect(updateReparacionRepuestos).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Quitar' }));
      await waitFor(() => expect(updateReparacionRepuestos).toHaveBeenCalledWith(10, 101, []));
    });

    it('cancelar la confirmación no quita nada', async () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Quitar Batería Y' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(updateReparacionRepuestos).not.toHaveBeenCalled();
    });

    it('un TECNICO que no es el de la orden no ve controles de edición', () => {
      state.orden = { ...(state.orden as object), tecnicoId: 99 };
      renderPage();
      expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Quitar/ })).not.toBeInTheDocument();
    });
  });

  describe('técnico por nombre (item 7)', () => {
    it('prefiere orden.tecnicoNombre al de la sesión', () => {
      state.orden = makeOrden({ tecnicoNombre: 'Nombre Backend' });
      renderPage();
      expect(screen.getByText('Nombre Backend')).toBeInTheDocument();
      expect(screen.queryByText('Tec Uno')).not.toBeInTheDocument();
    });
  });

  describe('sección Repuestos: legado, cobrado, bloqueo (items 1,2,4,5,6)', () => {
    const rev = (over: Record<string, unknown> = {}) => ({
      ...makeOrden().reparaciones[0],
      ...over,
    });
    const rep2 = (repuestos: unknown[]) => ({
      id: 101,
      ordenId: 10,
      tipo: 'PANTALLA',
      descripcion: 'Cambio de pantalla',
      precio: 120,
      createdAt: '',
      repuestos,
    });
    const snapP = (id: number, productoId: number | null, nombre: string) => ({
      id,
      repuestoId: productoId == null ? 2 : null,
      productoId,
      nombre,
      precioCosto: 10,
      precioVenta: 20,
      precioCobrado: 20,
    });

    it('snapshot legado: solo lectura, etiquetado y sin Quitar; no se envía en el PUT', async () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [rev({ repuestos: [] }), rep2([snapP(1, null, 'Viejo'), snapP(2, 3, 'Cable Z')])],
      });
      renderPage();
      const lista = screen.getByRole('list', { name: 'Repuestos adjuntos' });
      expect(within(lista).getByText('Viejo')).toBeInTheDocument();
      expect(within(lista).getByText(/legado/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Quitar Viejo' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Quitar Cable Z' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Quitar' }));
      await waitFor(() => expect(updateReparacionRepuestos).toHaveBeenCalledWith(10, 101, []));
    });

    it('Agregar ofrece todo el catálogo: el mismo producto puede estar en varias reparaciones', () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [rev(), rep2([snapP(2, 2, 'Batería Y')])],
      });
      renderPage();
      const values = within(screen.getByLabelText('Agregar repuesto'))
        .getAllByRole('option')
        .map((o) => (o as HTMLOptionElement).value);
      expect(values).toEqual(expect.arrayContaining(['1', '2', '3']));
    });

    it('con descuentoDiagnostico la fila de la Revisión dice "no cobrado"', () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        descuentoDiagnostico: true,
        reparaciones: [rev(), rep2([snapP(2, 2, 'Batería Y')])],
      });
      renderPage();
      const lista = screen.getByRole('list', { name: 'Repuestos adjuntos' });
      expect(within(lista).getByText('no cobrado')).toBeInTheDocument();
      expect(within(lista).getByText('Revisión inicial')).toBeInTheDocument();
      expect(within(lista).getByText('Cambio de pantalla')).toBeInTheDocument();
    });

    it('muestra x2, precio unitario y total de la línea, y el stepper reenvía la cantidad', async () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [
          rev({ repuestos: [] }),
          rep2([{ ...snapP(5, 3, 'Cable Z'), cantidad: 2, precioCobrado: 20, totalCobrado: 40 }]),
        ],
      });
      renderPage();
      const lista = screen.getByRole('list', { name: 'Repuestos adjuntos' });
      expect(within(lista).getByTestId('cantidad-5')).toHaveTextContent('2');
      expect(within(lista).getByText(/40/)).toBeInTheDocument();
      expect(within(lista).getByText(/20.*c\/u/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad de Cable Z' }));
      await waitFor(() =>
        expect(updateReparacionRepuestos).toHaveBeenLastCalledWith(10, 101, [{ productoId: 3, cantidad: 3 }]),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Disminuir cantidad de Cable Z' }));
      await waitFor(() =>
        expect(updateReparacionRepuestos).toHaveBeenLastCalledWith(10, 101, [{ productoId: 3, cantidad: 1 }]),
      );
    });

    const keysInvalidadas = () =>
      state.invalidate.mock.calls.map((c: unknown[]) => (c[0] as { queryKey: unknown[] }).queryKey[0]);

    it('tras cambiar repuestos refresca órdenes, inventario y el stock de useRepuestos', async () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [rev({ repuestos: [] }), rep2([snapP(2, 2, 'Batería Y')])],
      });
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad de Batería Y' }));
      await waitFor(() => expect(keysInvalidadas()).toEqual(expect.arrayContaining(['ordenes', 'inventario', 'repuestos'])));
    });

    it('la mutación no termina hasta que el refetch se resuelve (stepper bloqueado mientras tanto)', async () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [rev({ repuestos: [] }), rep2([snapP(2, 2, 'Batería Y')])],
      });
      const liberar: (() => void)[] = [];
      state.invalidate = vi.fn(() => new Promise<void>((r) => liberar.push(r)));
      vi.mocked(updateReparacionRepuestos).mockResolvedValueOnce({ repuestos: [] } as never);
      renderPage();
      fireEvent.change(screen.getByLabelText('Agregar repuesto'), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
      await waitFor(() => expect(updateReparacionRepuestos).toHaveBeenCalled());
      await waitFor(() => expect(state.invalidate).toHaveBeenCalled());
      // El aviso post-mutación solo aparece cuando la invalidación terminó.
      expect(state.showToast).not.toHaveBeenCalled();
      liberar.forEach((fn) => fn());
      await waitFor(() => expect(state.showToast).toHaveBeenCalledWith(expect.any(String), 'warning'));
    });

    it('un cambio de estado también refresca el stock de repuestos', async () => {
      state.orden = makeOrden({ estado: EstadoOrden.DIAGNOSTICO });
      renderPage();
      fireEvent.click(within(screen.getByTitle('Rechazar Presupuesto')).getByRole('button'));
      await waitFor(() => expect(updateOrdenEstado).toHaveBeenCalled());
      await waitFor(() => expect(keysInvalidadas()).toEqual(expect.arrayContaining(['ordenes', 'repuestos'])));
    });

    it('no se puede bajar de 1 con el stepper', () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [rev({ repuestos: [] }), rep2([snapP(2, 2, 'Batería Y')])],
      });
      renderPage();
      expect(screen.getByRole('button', { name: 'Disminuir cantidad de Batería Y' })).toBeDisabled();
    });

    it('un 400 de stock insuficiente al agregar se muestra en toast', async () => {
      const msg = 'Stock insuficiente de Cable Z. Disponible: 1';
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [rev({ repuestos: [] }), rep2([snapP(2, 2, 'Batería Y')])],
      });
      vi.mocked(updateReparacionRepuestos).mockRejectedValueOnce(new Error(msg));
      renderPage();
      fireEvent.change(screen.getByLabelText('Agregar repuesto'), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
      await waitFor(() => expect(state.showToast).toHaveBeenCalledWith(msg, 'error'));
    });

    it('advierte con toast si tras agregar el repuesto no quedó en la orden', async () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [rev(), rep2([snapP(2, 2, 'Batería Y')])],
      });
      vi.mocked(updateReparacionRepuestos).mockResolvedValueOnce({ repuestos: [] } as never);
      renderPage();
      fireEvent.change(screen.getByLabelText('Agregar repuesto'), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
      await waitFor(() => expect(state.showToast).toHaveBeenCalledWith(expect.any(String), 'warning'));
    });

    it.each([EstadoOrden.PAGADO, EstadoOrden.ENTREGADO])('%s: sin controles y con nota', (estado) => {
      state.orden = makeOrden({
        estado,
        reparaciones: [rev(), rep2([snapP(2, 2, 'Batería Y')])],
      });
      renderPage();
      expect(screen.getByRole('button', { name: 'Quitar Batería Y' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument();
      expect(screen.getByText(/orden pagada o entregada/)).toBeInTheDocument();
    });

    it('muestra en toast el mensaje 409 del backend', async () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [rev(), rep2([snapP(2, 2, 'Batería Y')])],
      });
      const msg = 'No se pueden modificar los repuestos de una orden pagada o entregada';
      vi.mocked(updateReparacionRepuestos).mockRejectedValueOnce(new Error(msg));
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Quitar Batería Y' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Quitar' }));
      await waitFor(() => expect(state.showToast).toHaveBeenCalledWith(msg, 'error'));
    });
  });
  describe('permisos de asignación de técnico', () => {
    const ADMIN = { id: 1, nombre: 'Admin', username: 'admin', rol: 'ADMIN', activo: true, tecnicoId: 1 };
    const TECS = [{ id: 7, nombre: 'Tec Uno', username: 'tec', activo: true, correo: 't@x.com' }];

    it('ADMIN ve el selector "Cambiar técnico" y no "Asignarme"', () => {
      state.user = ADMIN;
      state.tecnicos = TECS;
      renderPage();
      expect(screen.getByLabelText('Cambiar técnico')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Asignarme' })).not.toBeInTheDocument();
    });

    it('ADMIN con lista vacía conserva al técnico asignado en el selector (no "Sin asignar")', () => {
      state.user = ADMIN;
      state.tecnicos = [];
      state.orden = makeOrden({ tecnicoId: 7, tecnicoNombre: 'Tec Uno' });
      renderPage();
      expect(screen.getByLabelText('Cambiar técnico')).toHaveValue('7');
    });

    it('ADMIN ve "Asignar técnico" en una orden sin técnico', () => {
      state.user = ADMIN;
      state.tecnicos = TECS;
      state.orden = makeOrden({ tecnicoId: null });
      renderPage();
      expect(screen.getByLabelText('Asignar técnico')).toBeInTheDocument();
    });

    it('TECNICO en orden sin técnico: solo "Asignarme", sin selector', () => {
      state.orden = makeOrden({ tecnicoId: null });
      renderPage();
      expect(screen.getByRole('button', { name: 'Asignarme' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Asignar técnico')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Cambiar técnico')).not.toBeInTheDocument();
    });

    it('TECNICO en su orden asignada: sin selector ni botón y nombre desde tecnicoNombre', () => {
      state.orden = makeOrden({ tecnicoId: 7, tecnicoNombre: 'Tec Uno' });
      renderPage();
      expect(screen.queryByLabelText('Cambiar técnico')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Asignarme' })).not.toBeInTheDocument();
      expect(screen.getByText('Tec Uno')).toBeInTheDocument();
    });

    it('TECNICO en orden de otro técnico: nombre por tecnicoNombre, sin selector', () => {
      state.orden = makeOrden({ tecnicoId: 9, tecnicoNombre: 'Otra Persona' });
      renderPage();
      expect(screen.getByText('Otra Persona')).toBeInTheDocument();
      expect(screen.queryByLabelText('Cambiar técnico')).not.toBeInTheDocument();
    });

    it('muestra en toast el 403 del backend al asignarme', async () => {
      state.orden = makeOrden({ tecnicoId: null });
      const msg = 'Solo puedes asignarte órdenes sin técnico';
      vi.mocked(asignarTecnico).mockRejectedValueOnce(new Error(msg));
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Asignarme' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Asignarme' }));
      await waitFor(() => expect(state.showToast).toHaveBeenCalledWith(msg, 'error'));
    });
  });

  describe('costos y ganancias', () => {
    const ADMIN = { id: 1, nombre: 'Admin', username: 'admin', rol: 'ADMIN', activo: true, tecnicoId: 1 };
    const conCostos = () =>
      makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [
          { id: 100, ordenId: 10, tipo: 'PANTALLA', descripcion: null, precio: 20, costoRepuesto: 50, precioRepuesto: 80, ganancia: 50, createdAt: '', repuestos: [] },
        ],
      });

    it('ADMIN ve costo de repuestos y ganancia estimada total', () => {
      state.user = ADMIN;
      state.orden = conCostos();
      renderPage();
      expect(screen.getByText('Costo de repuestos')).toBeInTheDocument();
      expect(screen.getByText('Ganancia estimada total')).toBeInTheDocument();
    });

    it('TECNICO no ve costo ni ganancia, pero sí lo cobrado', () => {
      state.orden = conCostos();
      renderPage();
      expect(screen.queryByText('Costo de repuestos')).not.toBeInTheDocument();
      expect(screen.queryByText('Ganancia estimada total')).not.toBeInTheDocument();
      expect(screen.getByText('Total cobrado')).toBeInTheDocument();
    });

    it('TECNICO con campos de costo en null no rompe ni muestra NaN', () => {
      state.orden = makeOrden({
        estado: EstadoOrden.REPARACION,
        reparaciones: [
          { id: 100, ordenId: 10, tipo: 'PANTALLA', descripcion: null, precio: 20, costoRepuesto: null, precioRepuesto: 80, ganancia: null, createdAt: '',
            repuestos: [{ id: 900, repuestoId: null, productoId: 1, nombre: 'Pantalla X', precioCosto: null, precioVenta: null, precioCobrado: null }] },
        ],
      });
      renderPage();
      expect(document.body.textContent).not.toContain('NaN');
    });

    it('el modal Aprobar y Reparar tolera repuestos sin precioCosto/precioVenta (sin NaN, sin costos)', async () => {
      REPUESTOS.push({ id: 99, nombre: 'Oculto', precioCosto: null as never, precioVenta: null });
      try {
        renderPage();
        fireEvent.click(within(screen.getByTitle('Aprobar y Reparar')).getByRole('button'));
        const dialog = await screen.findByRole('dialog');
        fireEvent.click(within(dialog).getByRole('checkbox', { name: /Oculto/ }));
        expect(dialog.textContent).not.toContain('NaN');
        expect(dialog.textContent).not.toMatch(/costo|ganancia/i);
      } finally {
        REPUESTOS.pop();
      }
    });
  });
});
