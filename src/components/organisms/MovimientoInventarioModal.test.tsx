import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MovimientoInventarioModal } from './MovimientoInventarioModal';
import { ApiError } from '../../api/ApiClient';
import type { ProductoInventario } from '../../types';

const productos = [
  { id: 1, codigo: 'P-1', nombre: 'Pantalla', stock: 2, stockMinimo: 1, costoUnitario: 100 },
  { id: 2, codigo: 'B-1', nombre: 'Batería', stock: 5, stockMinimo: 1, costoUnitario: 50 },
] as unknown as ProductoInventario[];

function setup(props: Partial<React.ComponentProps<typeof MovimientoInventarioModal>> = {}) {
  const onSubmitCompra = vi.fn().mockResolvedValue(undefined);
  const onSubmitAjuste = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <MovimientoInventarioModal
      isOpen
      onClose={onClose}
      productos={productos}
      onSubmitCompra={onSubmitCompra}
      onSubmitAjuste={onSubmitAjuste}
      {...props}
    />,
  );
  return { onSubmitCompra, onSubmitAjuste, onClose };
}

const registrar = () => fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

describe('MovimientoInventarioModal', () => {
  it('solo ofrece Compra y Ajuste, y no pide orden de trabajo', () => {
    setup();
    const select = screen.getByLabelText('Tipo de movimiento') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value).filter(Boolean)).toEqual(['COMPRA', 'AJUSTE']);
    expect(screen.queryByText(/Orden de trabajo/)).toBeNull();
  });

  it('Compra con varias líneas envía una sola petición con todas las líneas', async () => {
    const { onSubmitCompra, onClose } = setup();
    fireEvent.change(screen.getByLabelText('Producto línea 1'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Cantidad línea 1'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Costo unitario línea 1'), { target: { value: '120.5' } });

    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }));
    fireEvent.change(screen.getByLabelText('Producto línea 2'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Cantidad línea 2'), { target: { value: '4' } });
    // El costo se precarga con el costo actual del producto (50).
    expect(screen.getByLabelText('Costo unitario línea 2')).toHaveValue(50);

    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: ' Factura 77 ' } });
    registrar();

    await waitFor(() => expect(onSubmitCompra).toHaveBeenCalledTimes(1));
    expect(onSubmitCompra).toHaveBeenCalledWith({
      notas: 'Factura 77',
      lineas: [
        { productoId: 1, cantidad: 3, costoUnitario: 120.5 },
        { productoId: 2, cantidad: 4, costoUnitario: 50 },
      ],
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('Compra: no envía si falta cantidad o producto', async () => {
    const { onSubmitCompra } = setup();
    registrar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Seleccioná el producto');
    fireEvent.change(screen.getByLabelText('Producto línea 1'), { target: { value: '1' } });
    registrar();
    expect(await screen.findByRole('alert')).toHaveTextContent('cantidad válida');
    expect(onSubmitCompra).not.toHaveBeenCalled();
  });

  it('no ofrece productos archivados en los selectores', () => {
    setup({
      productos: [...productos, { id: 3, codigo: 'A-1', nombre: 'Archivado', archivado: true } as unknown as ProductoInventario],
    });
    const options = Array.from(
      (screen.getByLabelText('Producto línea 1') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toContain('1');
    expect(options).not.toContain('3');
  });

  it('precarga el producto cuando se abre desde una fila', () => {
    setup({ producto: productos[1] });
    expect(screen.getByLabelText('Producto línea 1')).toHaveValue('2');
  });

  describe('Ajuste', () => {
    const toAjuste = () =>
      fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'AJUSTE' } });

    it('exige sentido y nota', async () => {
      const { onSubmitAjuste } = setup();
      toAjuste();
      fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '2' } });
      fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '1' } });

      registrar();
      expect(await screen.findByRole('alert')).toHaveTextContent('suma o resta');

      fireEvent.change(screen.getByLabelText('Sentido'), { target: { value: 'ENTRADA' } });
      registrar();
      expect(await screen.findByRole('alert')).toHaveTextContent('La nota es obligatoria');
      expect(onSubmitAjuste).not.toHaveBeenCalled();
    });

    it('envía producto, cantidad, sentido y nota', async () => {
      const { onSubmitAjuste } = setup();
      toAjuste();
      fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '2' } });
      fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } });
      fireEvent.change(screen.getByLabelText('Sentido'), { target: { value: 'SALIDA' } });
      fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'Conteo físico' } });
      registrar();
      await waitFor(() =>
        expect(onSubmitAjuste).toHaveBeenCalledWith({
          productoId: 2,
          tipo: 'AJUSTE',
          cantidad: 2,
          sentido: 'SALIDA',
          notas: 'Conteo físico',
        }),
      );
    });

    it('avisa si una resta supera el stock conocido (solo ayuda)', async () => {
      const { onSubmitAjuste } = setup();
      toAjuste();
      fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '9' } });
      fireEvent.change(screen.getByLabelText('Sentido'), { target: { value: 'SALIDA' } });
      fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'x' } });
      registrar();
      expect(await screen.findByRole('alert')).toHaveTextContent('Stock insuficiente. Disponible: 2');
      expect(onSubmitAjuste).not.toHaveBeenCalled();
    });
  });

  it('muestra el mensaje del 400 del backend', async () => {
    const err = new ApiError('Bad Request', 400, { meta: { message: 'Stock insuficiente en el servidor' } });
    const { onSubmitCompra, onClose } = setup({
      onSubmitCompra: vi.fn().mockRejectedValue(err),
    });
    expect(onSubmitCompra).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Producto línea 1'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Cantidad línea 1'), { target: { value: '1' } });
    registrar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Stock insuficiente en el servidor');
    expect(onClose).not.toHaveBeenCalled();
  });
});
