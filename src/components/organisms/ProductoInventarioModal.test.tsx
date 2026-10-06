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
      fireEvent.change(screen.getAllByPlaceholderText('0').pop() as HTMLElement, {
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
    fireEvent.change(screen.getAllByPlaceholderText('0').pop() as HTMLElement, {
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

describe('ProductoInventarioModal uso', () => {
  const fillNew = () => {
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'COD-1' } });
    fireEvent.change(inputs[1], { target: { value: 'Funda' } });
    const precio = screen.getAllByPlaceholderText('0').pop() as HTMLElement;
    fireEvent.change(precio, { target: { value: '5' } });
  };

  it('defaults a new product to VENTA and offers only Venta and Ambos', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductoInventarioModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);
    const select = screen.getByLabelText('Uso') as HTMLSelectElement;
    expect(select.value).toBe('VENTA');
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['VENTA', 'AMBOS']);

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

  it('shows REPUESTO as a disabled value when editing a repuesto product', () => {
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
    expect(select).toBeDisabled();
  });
});
