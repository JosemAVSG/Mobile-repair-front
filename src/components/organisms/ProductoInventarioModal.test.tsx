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
  uso: 'AMBOS',
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
    fireEvent.change(screen.getByLabelText('Uso'), { target: { value: 'AMBOS' } });
    fireEvent.change(screen.getByLabelText('Agregar modelo compatible'), {
      target: { value: '11' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].modeloIds).toEqual([11]);
  });
});

describe('ProductoInventarioModal uso', () => {
  const fillNew = () => {
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'COD-1' } });
    fireEvent.change(inputs[1], { target: { value: 'Funda' } });
    const precio = screen.getAllByPlaceholderText('0')[1] as HTMLElement;
    fireEvent.change(precio, { target: { value: '5' } });
  };

  it('defaults a new product to VENTA and offers Venta, Repuesto and Ambos', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);
    const select = screen.getByLabelText('Uso') as HTMLSelectElement;
    expect(select.value).toBe('VENTA');
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['VENTA', 'REPUESTO', 'AMBOS']);

    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].uso).toBe('VENTA');
  });

  it('lets a new product be set to AMBOS and sends it in the payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);
    fillNew();
    fireEvent.change(screen.getByLabelText('Uso'), { target: { value: 'AMBOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].uso).toBe('AMBOS');
  });

  it('keeps AMBOS when editing an AMBOS product', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProductoInventarioModal
        isOpen
        onClose={vi.fn()}
        producto={{ ...producto, uso: 'AMBOS' }}
        onSubmit={onSubmit}
      />,
    );
    expect((screen.getByLabelText('Uso') as HTMLSelectElement).value).toBe('AMBOS');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].uso).toBe('AMBOS');
  });

  it('allows changing uso when editing a repuesto product', () => {
    render(
      <ProductoInventarioModal
        isOpen
        onClose={vi.fn()}
        producto={{ ...producto, uso: 'REPUESTO' }}
        onSubmit={vi.fn()}
      />,
    );
    const select = screen.getByLabelText('Uso') as HTMLSelectElement;
    expect(select.value).toBe('REPUESTO');
    expect(select).toBeEnabled();
  });
});

describe('ProductoInventarioModal conditional fields', () => {
  const renderNew = (props: Record<string, unknown> = {}) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} onSubmit={onSubmit} {...props} />);
    return onSubmit;
  };
  const setUso = (v: string) =>
    fireEvent.change(screen.getByLabelText('Uso'), { target: { value: v } });
  const fill = () => {
    fireEvent.change(screen.getByPlaceholderText('Ej: BAT-IP13'), { target: { value: 'X-1' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Batería iPhone 13'), {
      target: { value: 'Prod' },
    });
  };

  it('Venta: stock controlado, sin marca/tipo/modelos', () => {
    renderNew();
    expect(screen.getByLabelText('Controlar stock')).toBeChecked();
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.queryByLabelText('Marca')).toBeNull();
    expect(screen.queryByLabelText('Tipo de reparación')).toBeNull();
    expect(screen.queryByLabelText('Agregar modelo compatible')).toBeNull();
  });

  it('Repuesto: stock apagado, marca/tipo/modelos visibles, precio de venta opcional', async () => {
    const onSubmit = renderNew();
    setUso('REPUESTO');
    expect(screen.getByLabelText('Controlar stock')).not.toBeChecked();
    expect(screen.queryByText('Stock mínimo')).toBeNull();
    expect(screen.getByLabelText('Marca')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de reparación')).toBeInTheDocument();
    expect(screen.getByLabelText('Agregar modelo compatible')).toBeInTheDocument();
    fill();
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Tipo de reparación'), { target: { value: 'BATERIA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const body = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({
      uso: 'REPUESTO',
      controlaStock: false,
      marcaId: 1,
      tipoReparacion: 'BATERIA',
    });
    expect('precioVenta' in body).toBe(false);
  });

  it('Venta exige precio de venta; Ambos muestra campos de repuesto', async () => {
    const onSubmit = renderNew();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ingrese un precio de venta mayor a 0')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    setUso('AMBOS');
    expect(screen.getByLabelText('Controlar stock')).toBeChecked();
    expect(screen.getByLabelText('Marca')).toBeInTheDocument();
  });

  it('apagar Controlar stock oculta stock y mínimo', () => {
    renderNew();
    fireEvent.click(screen.getByLabelText('Controlar stock'));
    expect(screen.queryByText('Stock mínimo')).toBeNull();
  });

  it('sin plan: solo Repuesto habilitado, con hint, y arranca en Repuesto', () => {
    renderNew({ inventarioHabilitado: false });
    expect(screen.getByLabelText('Uso')).toHaveValue('REPUESTO');
    expect(screen.getByRole('option', { name: 'Venta' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Ambos' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Repuesto' })).toBeEnabled();
    expect(screen.getByText(/Requiere el plan con ventas e inventario/)).toBeInTheDocument();
    // M3: el toggle se muestra sin plan (apagado y bloqueado), los campos de stock no.
    expect(screen.getByLabelText('Controlar stock')).toBeInTheDocument();
    expect(screen.queryByText('Stock mínimo')).toBeNull();
  });
});

describe('ProductoInventarioModal PUT body (PATCH semantics)', () => {
  const repuesto = {
    ...producto,
    uso: 'REPUESTO',
    controlaStock: true,
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

  it('M1: en el alta solo se envian los opcionales completados', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('Ej: BAT-IP13'), { target: { value: 'N-1' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Batería iPhone 13'), {
      target: { value: 'Nuevo' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('0')[1] as HTMLElement, {
      target: { value: '5' },
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

  it('M2: stock/stockMinimo solo viajan si cambiaron', async () => {
    const body = await edit(repuesto, () =>
      fireEvent.change(screen.getAllByPlaceholderText('0')[2] as HTMLElement, {
        target: { value: '9' },
      }),
    );
    expect(body.stock).toBe(9);
    expect('stockMinimo' in body).toBe(false);
  });

  it('M2: con controlaStock apagado no envia stock aunque haya cambiado', async () => {
    const body = await edit(repuesto, () => {
      fireEvent.change(screen.getAllByPlaceholderText('0')[2] as HTMLElement, {
        target: { value: '9' },
      });
      fireEvent.click(screen.getByLabelText('Controlar stock'));
    });
    expect(body.controlaStock).toBe(false);
    expect('stock' in body).toBe(false);
    expect('stockMinimo' in body).toBe(false);
  });

  it('M3: sin plan se puede apagar el control en un repuesto que lo tiene', async () => {
    const toggle = () => screen.getByLabelText('Controlar stock');
    const body = await edit(
      repuesto,
      () => {
        expect(toggle()).toBeEnabled();
        fireEvent.click(toggle());
        expect(toggle()).toBeDisabled();
      },
      { inventarioHabilitado: false },
    );
    expect(body.controlaStock).toBe(false);
    expect('stock' in body).toBe(false);
  });

  it('LOW a: cambiar uso al editar no resetea controlaStock', async () => {
    const body = await edit(repuesto, () =>
      fireEvent.change(screen.getByLabelText('Uso'), { target: { value: 'AMBOS' } }),
    );
    expect(body.controlaStock).toBe(true);
    expect(screen.getByLabelText('Controlar stock')).toBeChecked();
  });

  it('LOW a: cambiar uso al crear si aplica el default', () => {
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Uso'), { target: { value: 'REPUESTO' } });
    expect(screen.getByLabelText('Controlar stock')).not.toBeChecked();
  });

  it('LOW b: convertir a VENTA limpia marca, tipo y modelos', async () => {
    const body = await edit(repuesto, () =>
      fireEvent.change(screen.getByLabelText('Uso'), { target: { value: 'VENTA' } }),
    );
    expect(body.limpiarMarca).toBe(true);
    expect(body.limpiarTipoReparacion).toBe(true);
    expect(body.modeloIds).toEqual([]);
  });
});
