import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProductoInventarioModal } from './ProductoInventarioModal';
import type { ProductoInventario } from '../../types';

vi.mock('../../hooks/useQueries', () => ({
  useMarcas: () => ({ data: [{ id: 1, nombre: 'Apple' }] }),
  useModelos: () => ({
    data: [
      { id: 10, nombre: 'iPhone 13', marcaId: 1 },
      { id: 11, nombre: 'iPhone 14', marcaId: 1 },
    ],
  }),
}));

const producto = {
  id: 5,
  codigo: 'BAT-1',
  nombre: 'Batería',
  stock: 3,
  stockMinimo: 1,
  estadoStock: 'OK',
  costoUnitario: 10,
  precioVenta: 20,
  modelosCompatibles: [10],
  createdAt: '',
} as unknown as ProductoInventario;

describe('ProductoInventarioModal modeloIds', () => {
  const submitEdit = async (prod: ProductoInventario, act?: () => void) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} producto={prod} onSubmit={onSubmit} />);
    act?.();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    return onSubmit.mock.calls[0][0] as Record<string, unknown>;
  };

  it('shows modelosCompatibles from the real backend shape', () => {
    render(
      <ProductoInventarioModal isOpen onClose={vi.fn()} producto={producto} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('Apple iPhone 13')).toBeInTheDocument();
  });

  it('omits modeloIds when the selection is untouched (price edit)', async () => {
    const body = await submitEdit(producto, () =>
      fireEvent.change(screen.getAllByPlaceholderText('0')[1] as HTMLElement, {
        target: { value: '99' },
      }),
    );
    expect(body.precioVenta).toBe(99);
    expect('modeloIds' in body).toBe(false);
  });

  it('omits modeloIds on an old backend without any compatibility data', async () => {
    const body = await submitEdit({ ...producto, modelosCompatibles: undefined });
    expect('modeloIds' in body).toBe(false);
  });

  it('sends the new list when a model is added', async () => {
    const body = await submitEdit(producto, () =>
      fireEvent.change(screen.getByLabelText('Agregar modelo compatible'), {
        target: { value: '11' },
      }),
    );
    expect(body.modeloIds).toEqual([10, 11]);
  });

  it('sends the reduced list when a chip is removed', async () => {
    const body = await submitEdit({ ...producto, modelosCompatibles: [10, 11] }, () =>
      fireEvent.click(screen.getByRole('button', { name: 'Quitar Apple iPhone 13' })),
    );
    expect(body.modeloIds).toEqual([11]);
  });

  it('sends [] when all chips are cleared', async () => {
    const body = await submitEdit(producto, () =>
      fireEvent.click(screen.getByRole('button', { name: 'Quitar Apple iPhone 13' })),
    );
    expect(body.modeloIds).toEqual([]);
  });

  it('sends the chosen models for a new product', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'COD-1' } });
    fireEvent.change(inputs[1], { target: { value: 'Funda' } });
    fireEvent.change(screen.getAllByPlaceholderText('0')[1] as HTMLElement, {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText('Agregar modelo compatible'), {
      target: { value: '11' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].modeloIds).toEqual([11]);
  });
});

describe('ProductoInventarioModal sin uso ni controlaStock', () => {
  const renderNew = () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);
    return onSubmit;
  };
  const fill = () => {
    fireEvent.change(screen.getByPlaceholderText('Ej: BAT-IP13'), { target: { value: 'X-1' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Batería iPhone 13'), {
      target: { value: 'Prod' },
    });
  };

  it('no muestra Uso ni Controlar stock; siempre ofrece marca, tipo y modelos', () => {
    renderNew();
    expect(screen.queryByLabelText('Uso')).toBeNull();
    expect(screen.queryByLabelText('Controlar stock')).toBeNull();
    expect(screen.getByLabelText('Marca')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de reparación')).toBeInTheDocument();
    expect(screen.getByLabelText('Agregar modelo compatible')).toBeInTheDocument();
  });

  it('precio sugerido es opcional y no se envía si está vacío; no hay uso/controlaStock', async () => {
    const onSubmit = renderNew();
    expect(screen.getByText('Precio sugerido a cobrar')).toBeInTheDocument();
    expect(
      screen.getByText('Si lo dejás vacío, el repuesto se cobra a su costo.'),
    ).toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const body = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect('precioVenta' in body).toBe(false);
    expect('uso' in body).toBe(false);
    expect('controlaStock' in body).toBe(false);
  });

  it('el stock inicial solo existe al crear', () => {
    renderNew();
    expect(screen.getByText('Stock inicial')).toBeInTheDocument();
  });

  it('al editar no hay campo de stock y no viaja stock', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} producto={producto} onSubmit={onSubmit} />);
    expect(screen.queryByText('Stock inicial')).toBeNull();
    expect(screen.getByText(/Stock actual/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect('stock' in onSubmit.mock.calls[0][0]).toBe(false);
  });
});

describe('ProductoInventarioModal PUT body (PATCH semantics)', () => {
  const repuesto = {
    ...producto,
    categoria: 'Pantallas',
    variante: 'Negra',
    proveedor: 'ACME',
    marcaId: 1,
    tipoReparacion: 'BATERIA',
    modelosCompatibles: [10],
  } as unknown as ProductoInventario;

  const edit = async (
    prod: ProductoInventario,
    act?: () => void,
    props: Record<string, unknown> = {},
  ) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProductoInventarioModal
        isOpen
        onClose={vi.fn()}
        producto={prod}
        onSubmit={onSubmit}
        {...props}
      />,
    );
    act?.();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    return onSubmit.mock.calls[0][0] as Record<string, unknown>;
  };
  const textboxByValue = (v: string) =>
    screen.getAllByRole('textbox').find((e) => (e as HTMLInputElement).value === v) as HTMLElement;

  it('M1: sin cambios no envia opcionales ni stock', async () => {
    const body = await edit(repuesto);
    for (const k of [
      'categoria',
      'variante',
      'proveedor',
      'marcaId',
      'tipoReparacion',
      'limpiarMarca',
      'limpiarTipoReparacion',
      'modeloIds',
      'stock',
      'stockMinimo',
    ]) {
      expect(k in body).toBe(false);
    }
  });

  it('M1: vaciar strings envia "" ; cambiar uno envia el nuevo valor', async () => {
    const body = await edit(repuesto, () => {
      fireEvent.change(textboxByValue('Pantallas'), { target: { value: '' } });
      fireEvent.change(textboxByValue('Negra'), { target: { value: 'Blanca' } });
    });
    expect(body.categoria).toBe('');
    expect(body.variante).toBe('Blanca');
    expect('proveedor' in body).toBe(false);
  });

  it('M1: vaciar marca y tipo envia limpiarMarca/limpiarTipoReparacion', async () => {
    const body = await edit(repuesto, () => {
      fireEvent.change(screen.getByLabelText('Marca'), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText('Tipo de reparación'), { target: { value: '' } });
    });
    expect(body.limpiarMarca).toBe(true);
    expect(body.limpiarTipoReparacion).toBe(true);
    expect('marcaId' in body).toBe(false);
    expect('tipoReparacion' in body).toBe(false);
  });

  it('vaciar el precio sugerido al editar envia limpiarPrecioVenta y omite precioVenta', async () => {
    const body = await edit(repuesto, () =>
      fireEvent.change(screen.getAllByPlaceholderText('0')[1] as HTMLElement, {
        target: { value: '' },
      }),
    );
    expect(body.limpiarPrecioVenta).toBe(true);
    expect('precioVenta' in body).toBe(false);
  });

  it('sin tocar el precio envia el numero y no limpiarPrecioVenta', async () => {
    const body = await edit(repuesto);
    expect(body.precioVenta).toBe(20);
    expect('limpiarPrecioVenta' in body).toBe(false);
  });

  it('precio vacio sin precio previo no envia nada de precio', async () => {
    const body = await edit({ ...repuesto, precioVenta: null });
    expect('precioVenta' in body).toBe(false);
    expect('limpiarPrecioVenta' in body).toBe(false);
  });

  it('M1: en el alta solo se envian los opcionales completados', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('Ej: BAT-IP13'), { target: { value: 'N-1' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Batería iPhone 13'), {
      target: { value: 'Nuevo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const body = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    for (const k of ['categoria', 'variante', 'proveedor', 'limpiarMarca', 'limpiarTipoReparacion']) {
      expect(k in body).toBe(false);
    }
    expect(body.stock).toBe(0);
    expect(body.stockMinimo).toBe(0);
  });

  it('M2: stockMinimo solo viaja si cambió y stock nunca viaja', async () => {
    const body = await edit(repuesto, () =>
      fireEvent.change(screen.getAllByPlaceholderText('0')[2] as HTMLElement, {
        target: { value: '9' },
      }),
    );
    expect(body.stockMinimo).toBe(9);
    expect('stock' in body).toBe(false);
  });
});
