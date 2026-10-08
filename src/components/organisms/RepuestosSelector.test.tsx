import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RepuestosSelector, totalesSeleccion } from './RepuestosSelector';
import type { Repuesto } from '../../types';

const repuestos = [
  { id: 1, nombre: 'Pantalla', precioCosto: 50, precioVenta: 80, stock: 4 },
  { id: 2, nombre: 'Batería', precioCosto: 10, precioVenta: null },
] as unknown as Repuesto[];

describe('totalesSeleccion', () => {
  it('multiplica costo y cobro por la cantidad (venta con fallback al costo)', () => {
    expect(totalesSeleccion(repuestos, { 1: 2, 2: 3 })).toEqual({ costo: 130, cobrar: 190 });
  });

  it('sin selección es cero', () => {
    expect(totalesSeleccion(repuestos, {})).toEqual({ costo: 0, cobrar: 0 });
  });
});

describe('RepuestosSelector', () => {
  const setup = (seleccion: Record<number, number> = {}) => {
    const onToggle = vi.fn();
    const onCantidadChange = vi.fn();
    render(
      <RepuestosSelector
        repuestos={repuestos}
        seleccion={seleccion}
        onToggle={onToggle}
        onCantidadChange={onCantidadChange}
        idPrefix="t"
      />,
    );
    return { onToggle, onCantidadChange };
  };

  it('muestra el stock solo cuando el dato existe', () => {
    setup();
    expect(screen.getByText(/Stock: 4/)).toBeInTheDocument();
    expect(screen.getAllByText(/Stock:/)).toHaveLength(1);
  });

  it('el input de cantidad aparece solo para los seleccionados', () => {
    const { onCantidadChange } = setup({ 1: 2 });
    expect(screen.queryByLabelText('Cantidad de Batería')).toBeNull();
    fireEvent.change(screen.getByLabelText('Cantidad de Pantalla'), { target: { value: '5' } });
    expect(onCantidadChange).toHaveBeenCalledWith(1, 5);
  });
});
